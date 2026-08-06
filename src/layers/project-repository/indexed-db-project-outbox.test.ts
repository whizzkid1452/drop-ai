import { IDBFactory as FakeIDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProjectCrdtDocument } from '../project-crdt/project-crdt-document';
import { decodeProjectCrdtUpdate } from '../project-crdt/project-crdt-update-codec';
import type { ProjectDocument } from '../shared/types/project-document.schema';
import { ProjectRepositoryErrorCode } from './errors';
import { IndexedDbProjectRepository } from './indexed-db-project-repository';

const DATABASE_NAME = 'drop-ai-project-outbox-test';
const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const FIRST_OPERATION_ID = '22222222-2222-4222-8222-222222222222';
const SECOND_OPERATION_ID = '33333333-3333-4333-8333-333333333333';
const CREATED_AT = 1_000;

function createProjectDocument({ name = '새 프로젝트', revision = 0 } = {}): ProjectDocument {
  return {
    documentType: 'drop-ai-project',
    schemaVersion: 1,
    project: { id: PROJECT_ID, name, revision },
    timeline: { timeUnit: 'seconds', tempoBpm: 120 },
    mixer: { masterVolume: 1 },
    exportRange: null,
    audioSources: [],
    tracks: [],
  };
}

describe('IndexedDbProjectRepository Outbox', () => {
  let indexedDb: IDBFactory;
  let repositories: IndexedDbProjectRepository[];

  beforeEach(() => {
    indexedDb = new FakeIDBFactory();
    repositories = [];
  });

  afterEach(async () => {
    await Promise.all(repositories.map(repository => repository.close()));
  });

  function createRepository(now: () => number = () => CREATED_AT): IndexedDbProjectRepository {
    const repository = new IndexedDbProjectRepository({ databaseName: DATABASE_NAME, indexedDb, now });
    repositories.push(repository);
    return repository;
  }

  it('새 프로젝트 문서와 전송 대기 변경을 하나의 commit으로 저장한다', async () => {
    const repository = createRepository();

    const committed = await repository.commitLocal({
      document: createProjectDocument(),
      expectedRevision: 0,
      operationId: FIRST_OPERATION_ID,
    });

    expect(committed.document.project.revision).toBe(0);
    expect(committed.outboxEntry).toMatchObject({
      operationId: FIRST_OPERATION_ID,
      projectId: PROJECT_ID,
      baseRevision: null,
      localRevision: 0,
      crdtUpdateBase64: expect.any(String),
      attemptCount: 0,
      nextAttemptAtEpochMilliseconds: CREATED_AT,
    });
    await expect(repository.listPendingChanges({ dueAtEpochMilliseconds: CREATED_AT })).resolves.toEqual([
      committed.outboxEntry,
    ]);
  });

  it('기존 프로젝트 revision과 전송 대기 변경을 함께 증가시킨다', async () => {
    const repository = createRepository();
    const firstCommit = await repository.commitLocal({
      document: createProjectDocument(),
      expectedRevision: 0,
      operationId: FIRST_OPERATION_ID,
    });

    const committed = await repository.commitLocal({
      document: createProjectDocument({ name: '편집한 프로젝트' }),
      expectedRevision: 0,
      operationId: SECOND_OPERATION_ID,
    });

    expect(committed.document.project).toEqual({ id: PROJECT_ID, name: '편집한 프로젝트', revision: 1 });
    expect(committed.outboxEntry).toMatchObject({ baseRevision: 0, localRevision: 1 });
    await expect(repository.load(PROJECT_ID)).resolves.toEqual(committed.document);
    const remoteDocument = ProjectCrdtDocument.fromUpdate(
      decodeProjectCrdtUpdate(firstCommit.outboxEntry.crdtUpdateBase64 ?? '')
    );
    remoteDocument.applyUpdate(decodeProjectCrdtUpdate(committed.outboxEntry.crdtUpdateBase64 ?? ''));
    expect(remoteDocument.toProjectDocument()).toEqual(committed.document);
    remoteDocument.destroy();
  });

  it('확인된 변경만 Outbox에서 제거한다', async () => {
    const repository = createRepository();
    await repository.commitLocal({
      document: createProjectDocument(),
      expectedRevision: 0,
      operationId: FIRST_OPERATION_ID,
    });

    await repository.acknowledgePendingChange(FIRST_OPERATION_ID);

    await expect(repository.listPendingChanges({ dueAtEpochMilliseconds: CREATED_AT })).resolves.toEqual([]);
  });

  it('재시도 시각 전에는 변경을 반환하지 않고 시각이 지나면 반환한다', async () => {
    const repository = createRepository();
    await repository.commitLocal({
      document: createProjectDocument(),
      expectedRevision: 0,
      operationId: FIRST_OPERATION_ID,
    });
    await repository.schedulePendingChangeRetry({
      operationId: FIRST_OPERATION_ID,
      nextAttemptAtEpochMilliseconds: 2_000,
    });

    await expect(repository.listPendingChanges({ dueAtEpochMilliseconds: 1_999 })).resolves.toEqual([]);
    await expect(repository.listPendingChanges({ dueAtEpochMilliseconds: 2_000 })).resolves.toEqual([
      expect.objectContaining({ attemptCount: 1, nextAttemptAtEpochMilliseconds: 2_000 }),
    ]);
  });

  it('유효하지 않은 operation ID면 프로젝트 문서도 저장하지 않는다', async () => {
    const repository = createRepository();

    await expect(
      repository.commitLocal({
        document: createProjectDocument(),
        expectedRevision: 0,
        operationId: 'invalid-operation-id',
      })
    ).rejects.toMatchObject({ code: ProjectRepositoryErrorCode.INVALID_OPERATION_ID });
    await expect(repository.load(PROJECT_ID)).resolves.toBeNull();
  });

  it('Outbox 기록이 실패하면 프로젝트 문서 변경도 되돌린다', async () => {
    const repository = createRepository();
    await repository.commitLocal({
      document: createProjectDocument(),
      expectedRevision: 0,
      operationId: FIRST_OPERATION_ID,
    });

    await expect(
      repository.commitLocal({
        document: createProjectDocument({ name: '저장되면 안 되는 변경' }),
        expectedRevision: 0,
        operationId: FIRST_OPERATION_ID,
      })
    ).rejects.toMatchObject({ code: ProjectRepositoryErrorCode.STORAGE_OPERATION_FAILED });

    await expect(repository.load(PROJECT_ID)).resolves.toEqual(createProjectDocument());
    await expect(repository.listPendingChanges({ dueAtEpochMilliseconds: CREATED_AT })).resolves.toHaveLength(1);
  });
});
