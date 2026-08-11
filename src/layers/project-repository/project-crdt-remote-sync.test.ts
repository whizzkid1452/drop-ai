import { IDBFactory as FakeIDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectCrdtDocument } from '../project-crdt/project-crdt-document';
import { encodeProjectCrdtUpdate } from '../project-crdt/project-crdt-update-codec';
import type { ProjectDocument } from '../shared/types/project-document.schema';
import { IndexedDbProjectRepository } from './indexed-db-project-repository';
import { InMemoryProjectRepository } from './in-memory-project-repository';
import type { ILocalFirstProjectRepository, RemoteProjectCrdtUpdate } from './i-project-repository';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const LOCAL_OPERATION_ID = '22222222-2222-4222-8222-222222222222';

function createProjectDocument({
  masterVolume = 1,
  name = '새 프로젝트',
  revision = 0,
}: {
  readonly masterVolume?: number;
  readonly name?: string;
  readonly revision?: number;
} = {}): ProjectDocument {
  return {
    documentType: 'drop-ai-project',
    schemaVersion: 1,
    project: { id: PROJECT_ID, name, revision },
    timeline: { timeUnit: 'seconds', tempoBpm: 120 },
    mixer: { masterVolume },
    exportRange: null,
    audioSources: [],
    tracks: [],
  };
}

function createRemoteUpdates(): readonly RemoteProjectCrdtUpdate[] {
  const initialDocument = createProjectDocument();
  const remoteDocument = ProjectCrdtDocument.create(initialDocument);
  try {
    const initialUpdate = encodeProjectCrdtUpdate(remoteDocument.encodeStateAsUpdate());
    const changedDocument = createProjectDocument({ masterVolume: 0.5, revision: 1 });
    const mixerUpdate = encodeProjectCrdtUpdate(
      remoteDocument.applyProjectChange({
        baseDocument: initialDocument,
        nextDocument: changedDocument,
        origin: 'remote-test',
      })
    );
    return [
      {
        operationId: '33333333-3333-4333-8333-333333333333',
        sequenceId: 1,
        updateBase64: initialUpdate,
      },
      {
        operationId: '44444444-4444-4444-8444-444444444444',
        sequenceId: 2,
        updateBase64: mixerUpdate,
      },
    ];
  } finally {
    remoteDocument.destroy();
  }
}

interface RepositoryFixture {
  readonly name: string;
  readonly create: () => ILocalFirstProjectRepository;
}

const repositoriesToVerify: readonly RepositoryFixture[] = [
  {
    name: 'memory',
    create: () => new InMemoryProjectRepository({ now: () => 1_000 }),
  },
  {
    name: 'indexed-db',
    create: () =>
      new IndexedDbProjectRepository({
        databaseName: `project-crdt-remote-sync-${crypto.randomUUID()}`,
        indexedDb: new FakeIDBFactory(),
        now: () => 1_000,
      }),
  },
];

describe.each(repositoriesToVerify)('$name repository remote CRDT sync', ({ create }) => {
  const closeTasks: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(closeTasks.splice(0).map(close => close()));
  });

  function createRepository(): ILocalFirstProjectRepository {
    const repository = create();
    if (repository instanceof IndexedDbProjectRepository) {
      closeTasks.push(() => repository.close());
    }
    return repository;
  }

  it('원격 update와 마지막 sequence를 같은 로컬 상태에 반영한다', async () => {
    const repository = createRepository();

    const result = await repository.applyRemoteProjectUpdates({
      projectId: PROJECT_ID,
      updates: createRemoteUpdates(),
    });

    expect(result).toMatchObject({ appliedUpdateCount: 2, lastSequenceId: 2 });
    await expect(repository.load(PROJECT_ID)).resolves.toEqual(
      createProjectDocument({ masterVolume: 0.5, revision: 1 })
    );
    await expect(repository.getLastAppliedRemoteSequenceId(PROJECT_ID)).resolves.toBe(2);
  });

  it('로컬 미전송 변경을 유지하면서 원격 update를 병합한다', async () => {
    const repository = createRepository();
    const [initialUpdate, mixerUpdate] = createRemoteUpdates();
    await repository.applyRemoteProjectUpdates({ projectId: PROJECT_ID, updates: [initialUpdate] });
    await repository.commitLocal({
      document: createProjectDocument({ name: '로컬 이름' }),
      expectedRevision: 0,
      operationId: LOCAL_OPERATION_ID,
    });
    await expect(repository.getLastAppliedRemoteSequenceId(PROJECT_ID)).resolves.toBe(1);

    await repository.applyRemoteProjectUpdates({ projectId: PROJECT_ID, updates: [mixerUpdate] });

    await expect(repository.load(PROJECT_ID)).resolves.toEqual(
      createProjectDocument({ masterVolume: 0.5, name: '로컬 이름', revision: 1 })
    );
    await expect(repository.listPendingChanges({ dueAtEpochMilliseconds: 1_000 })).resolves.toHaveLength(1);
  });

  it('이미 반영한 sequence는 다시 적용하지 않는다', async () => {
    const repository = createRepository();
    const updates = createRemoteUpdates();
    await repository.applyRemoteProjectUpdates({ projectId: PROJECT_ID, updates });

    const result = await repository.applyRemoteProjectUpdates({ projectId: PROJECT_ID, updates });

    expect(result).toMatchObject({ appliedUpdateCount: 0, lastSequenceId: 2 });
  });

  it('로컬 CRDT state가 없으면 서버의 첫 update를 기준 이력으로 사용한다', async () => {
    const repository = createRepository();
    await repository.create(createProjectDocument({ name: '이전 JSON 문서' }));

    await repository.applyRemoteProjectUpdates({
      projectId: PROJECT_ID,
      updates: createRemoteUpdates(),
    });

    await expect(repository.load(PROJECT_ID)).resolves.toEqual(
      createProjectDocument({ masterVolume: 0.5, revision: 1 })
    );
  });
});

describe('IndexedDbProjectRepository remote CRDT transaction', () => {
  it('update 병합이 실패하면 문서와 sequence를 모두 유지한다', async () => {
    const repository = new IndexedDbProjectRepository({
      databaseName: 'project-crdt-remote-sync-atomicity',
      indexedDb: new FakeIDBFactory(),
      now: () => 1_000,
    });
    const [initialUpdate] = createRemoteUpdates();
    await repository.applyRemoteProjectUpdates({ projectId: PROJECT_ID, updates: [initialUpdate] });

    await expect(
      repository.applyRemoteProjectUpdates({
        projectId: PROJECT_ID,
        updates: [
          {
            operationId: '55555555-5555-4555-8555-555555555555',
            sequenceId: 2,
            updateBase64: 'AQID',
          },
        ],
      })
    ).rejects.toBeDefined();

    await expect(repository.load(PROJECT_ID)).resolves.toEqual(createProjectDocument());
    await expect(repository.getLastAppliedRemoteSequenceId(PROJECT_ID)).resolves.toBe(1);
    await repository.close();
  });
});
