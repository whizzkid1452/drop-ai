import { describe, expect, it } from 'vitest';
import type { ProjectDocument, ProjectDocumentV2 } from '../shared/types/project-document.schema';
import { InMemoryProjectRepository } from './in-memory-project-repository';
import { ProjectRepositoryErrorCode, type ProjectRepositoryErrorCode as RepositoryErrorCode } from './errors';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_PROJECT_ID = '55555555-5555-4555-8555-555555555555';
const SOURCE_ID = '22222222-2222-4222-8222-222222222222';
const TRACK_ID = '33333333-3333-4333-8333-333333333333';
const REGION_ID = '44444444-4444-4444-8444-444444444444';
const PLUGIN_INSTANCE_ID = '66666666-6666-4666-8666-666666666666';
const SAVED_AT_EPOCH_MILLISECONDS = 1_000;

interface CreateProjectDocumentOptions {
  projectId?: string;
  name?: string;
  revision?: number;
}

function createProjectDocument({
  projectId = PROJECT_ID,
  name = '새 프로젝트',
  revision = 0,
}: CreateProjectDocumentOptions = {}): ProjectDocument {
  return {
    documentType: 'drop-ai-project',
    schemaVersion: 1,
    project: { id: projectId, name, revision },
    timeline: { timeUnit: 'seconds', tempoBpm: 120 },
    mixer: { masterVolume: 1 },
    exportRange: null,
    audioSources: [
      {
        id: SOURCE_ID,
        fileName: 'voice.wav',
        mimeType: 'audio/wav',
        byteLength: 1_024,
        durationSeconds: 10,
      },
    ],
    tracks: [
      {
        id: TRACK_ID,
        name: 'Voice',
        volume: 1,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        regions: [
          {
            id: REGION_ID,
            sourceId: SOURCE_ID,
            startTimeSeconds: 0,
            sourceStartTimeSeconds: 0,
            durationSeconds: 10,
          },
        ],
      },
    ],
  };
}

function createProjectDocumentV2(options: CreateProjectDocumentOptions = {}): ProjectDocumentV2 {
  const document = createProjectDocument(options);

  return {
    ...document,
    schemaVersion: 2,
    tracks: document.tracks.map(track => ({
      ...track,
      pluginInstances: [
        {
          id: PLUGIN_INSTANCE_ID,
          manifestId: 'builtin.gain',
          manifestVersion: '1.0.0',
          isEnabled: true,
          parameters: [{ id: 'gain', value: 0.75 }],
        },
      ],
    })),
  };
}

async function expectRepositoryError(promise: Promise<unknown>, code: RepositoryErrorCode): Promise<void> {
  await expect(promise).rejects.toMatchObject({
    name: 'ProjectRepositoryError',
    code,
  });
}

describe('InMemoryProjectRepository', () => {
  it('revision 0인 새 프로젝트를 생성하고 불러온다', async () => {
    const repository = new InMemoryProjectRepository();
    const document = createProjectDocument();

    await expect(repository.create(document)).resolves.toEqual(document);
    await expect(repository.load(PROJECT_ID)).resolves.toEqual(document);
  });

  it('v2 문서의 Plugin 상태와 schemaVersion을 보존해 생성·조회한다', async () => {
    const repository = new InMemoryProjectRepository();
    const document = createProjectDocumentV2();

    const created = await repository.create(document);
    const loaded = await repository.load(PROJECT_ID);

    expect(created).toEqual(document);
    expect(loaded).toEqual(document);
    expect(loaded?.schemaVersion).toBe(2);
    expect(loaded?.tracks[0]).toMatchObject({
      pluginInstances: [{ id: PLUGIN_INSTANCE_ID, parameters: [{ id: 'gain', value: 0.75 }] }],
    });
  });

  it('v2 문서를 저장하면 revision만 증가시키고 Plugin 상태를 유지한다', async () => {
    const repository = new InMemoryProjectRepository();
    const document = createProjectDocumentV2();
    await repository.create(document);

    const saved = await repository.save({ document, expectedRevision: 0 });

    expect(saved).toMatchObject({
      schemaVersion: 2,
      project: { revision: 1 },
      tracks: [{ pluginInstances: [{ parameters: [{ id: 'gain', value: 0.75 }] }] }],
    });
    await expect(repository.load(PROJECT_ID)).resolves.toEqual(saved);
  });

  it('새 프로젝트의 revision이 0이 아니면 거부한다', async () => {
    const repository = new InMemoryProjectRepository();

    await expectRepositoryError(
      repository.create(createProjectDocument({ revision: 1 })),
      ProjectRepositoryErrorCode.INVALID_INITIAL_REVISION
    );
  });

  it('이미 존재하는 프로젝트 ID 생성을 거부한다', async () => {
    const repository = new InMemoryProjectRepository();
    const document = createProjectDocument();
    await repository.create(document);

    await expectRepositoryError(repository.create(document), ProjectRepositoryErrorCode.PROJECT_ALREADY_EXISTS);
  });

  it('현재 revision을 저장하면 내용을 교체하고 revision을 1 증가시킨다', async () => {
    const repository = new InMemoryProjectRepository();
    const document = createProjectDocument();
    await repository.create(document);

    const saved = await repository.save({
      document: {
        ...document,
        project: { ...document.project, name: '편집한 프로젝트' },
      },
      expectedRevision: 0,
    });
    const savedAgain = await repository.save({ document: saved, expectedRevision: 1 });

    expect(saved.project).toEqual({ id: PROJECT_ID, name: '편집한 프로젝트', revision: 1 });
    expect(savedAgain.project.revision).toBe(2);
    expect(document.project.revision).toBe(0);
    await expect(repository.load(PROJECT_ID)).resolves.toEqual(savedAgain);
  });

  it('오래된 revision 저장은 거부하고 최신 문서를 유지한다', async () => {
    const repository = new InMemoryProjectRepository();
    const document = createProjectDocument();
    await repository.create(document);
    const latest = await repository.save({
      document: {
        ...document,
        project: { ...document.project, name: '최신 프로젝트' },
      },
      expectedRevision: 0,
    });

    await expectRepositoryError(
      repository.save({ document, expectedRevision: 0 }),
      ProjectRepositoryErrorCode.REVISION_CONFLICT
    );
    await expect(repository.load(PROJECT_ID)).resolves.toEqual(latest);
  });

  it('문서 revision과 expectedRevision이 다르면 저장을 거부한다', async () => {
    const repository = new InMemoryProjectRepository();
    const document = createProjectDocument();
    await repository.create(document);

    await expectRepositoryError(
      repository.save({
        document: { ...document, project: { ...document.project, revision: 1 } },
        expectedRevision: 0,
      }),
      ProjectRepositoryErrorCode.REVISION_CONFLICT
    );
  });

  it('expectedRevision이 0 이상의 안전 정수가 아니면 저장과 삭제를 거부한다', async () => {
    const repository = new InMemoryProjectRepository();
    const document = createProjectDocument();
    await repository.create(document);

    const invalidRevisions = [-1, 0.5, Number.MAX_SAFE_INTEGER + 1];

    for (const expectedRevision of invalidRevisions) {
      await expectRepositoryError(
        repository.save({ document, expectedRevision }),
        ProjectRepositoryErrorCode.INVALID_EXPECTED_REVISION
      );
      await expectRepositoryError(
        repository.delete({ projectId: PROJECT_ID, expectedRevision }),
        ProjectRepositoryErrorCode.INVALID_EXPECTED_REVISION
      );
    }

    await expectRepositoryError(
      repository.save({ document, expectedRevision: Number.MAX_SAFE_INTEGER }),
      ProjectRepositoryErrorCode.INVALID_EXPECTED_REVISION
    );
  });

  it('같은 revision의 동시 저장 중 하나만 성공한다', async () => {
    const repository = new InMemoryProjectRepository();
    const document = createProjectDocument();
    await repository.create(document);

    const results = await Promise.allSettled([
      repository.save({
        document: { ...document, project: { ...document.project, name: '첫 번째 편집' } },
        expectedRevision: 0,
      }),
      repository.save({
        document: { ...document, project: { ...document.project, name: '두 번째 편집' } },
        expectedRevision: 0,
      }),
    ]);
    const fulfilledResults = results.filter(result => result.status === 'fulfilled');
    const rejectedResults = results.filter(result => result.status === 'rejected');

    expect(fulfilledResults).toHaveLength(1);
    expect(rejectedResults).toHaveLength(1);
    expect(rejectedResults[0]).toMatchObject({
      reason: expect.objectContaining({ code: ProjectRepositoryErrorCode.REVISION_CONFLICT }),
    });
  });

  it('입력값과 반환값 변경이 저장된 문서를 바꾸지 않는다', async () => {
    const repository = new InMemoryProjectRepository();
    const input = createProjectDocument();
    const created = await repository.create(input);

    input.project.name = '입력값 변경';
    created.project.name = '반환값 변경';
    created.tracks[0].regions[0].durationSeconds = 1;

    const loaded = await repository.load(PROJECT_ID);
    expect(loaded?.project.name).toBe('새 프로젝트');
    expect(loaded?.tracks[0].regions[0].durationSeconds).toBe(10);

    if (loaded) {
      loaded.project.name = '불러온 값 변경';
    }
    await expect(repository.load(PROJECT_ID)).resolves.toMatchObject({ project: { name: '새 프로젝트' } });
  });

  it('프로젝트 목록은 문서 본문 없이 요약만 반환한다', async () => {
    const repository = new InMemoryProjectRepository({ now: () => SAVED_AT_EPOCH_MILLISECONDS });
    await repository.create(createProjectDocument({ projectId: SECOND_PROJECT_ID, name: '두 번째' }));
    await repository.create(createProjectDocument({ projectId: PROJECT_ID, name: '첫 번째' }));

    const summaries = await repository.list();

    expect(summaries).toHaveLength(2);
    expect(summaries).toEqual(
      expect.arrayContaining([
        {
          projectId: PROJECT_ID,
          name: '첫 번째',
          revision: 0,
          savedAtEpochMilliseconds: SAVED_AT_EPOCH_MILLISECONDS,
        },
        {
          projectId: SECOND_PROJECT_ID,
          name: '두 번째',
          revision: 0,
          savedAtEpochMilliseconds: SAVED_AT_EPOCH_MILLISECONDS,
        },
      ])
    );
  });

  it('저장 성공 시 목록의 revision과 저장 시각을 함께 갱신한다', async () => {
    let currentTime = SAVED_AT_EPOCH_MILLISECONDS;
    const repository = new InMemoryProjectRepository({ now: () => currentTime });
    const document = createProjectDocument();
    await repository.create(document);
    currentTime = 2_000;

    await repository.save({ document, expectedRevision: 0 });

    await expect(repository.list()).resolves.toEqual([
      {
        projectId: PROJECT_ID,
        name: '새 프로젝트',
        revision: 1,
        savedAtEpochMilliseconds: 2_000,
      },
    ]);
  });

  it('현재 revision으로만 프로젝트를 삭제한다', async () => {
    const repository = new InMemoryProjectRepository();
    await repository.create(createProjectDocument());

    await expectRepositoryError(
      repository.delete({ projectId: PROJECT_ID, expectedRevision: 1 }),
      ProjectRepositoryErrorCode.REVISION_CONFLICT
    );
    await repository.delete({ projectId: PROJECT_ID, expectedRevision: 0 });

    await expect(repository.load(PROJECT_ID)).resolves.toBeNull();
    await expectRepositoryError(
      repository.delete({ projectId: PROJECT_ID, expectedRevision: 0 }),
      ProjectRepositoryErrorCode.PROJECT_NOT_FOUND
    );
  });

  it('없는 프로젝트 저장과 유효하지 않은 문서를 분류해 거부한다', async () => {
    const repository = new InMemoryProjectRepository();
    const invalidDocument = { ...createProjectDocument(), unexpected: true } as ProjectDocument;

    await expectRepositoryError(
      repository.save({ document: createProjectDocument(), expectedRevision: 0 }),
      ProjectRepositoryErrorCode.PROJECT_NOT_FOUND
    );
    await expectRepositoryError(repository.create(invalidDocument), ProjectRepositoryErrorCode.INVALID_DOCUMENT);
  });
});
