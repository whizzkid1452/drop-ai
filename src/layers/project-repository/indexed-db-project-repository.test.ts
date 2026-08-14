import { forceCloseDatabase, IDBFactory as FakeIDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ProjectDocument, ProjectDocumentV2 } from '../shared/types/project-document.schema';
import { ProjectRepositoryErrorCode } from './errors';
import { IndexedDbProjectRepository } from './indexed-db-project-repository';

const DATABASE_NAME = 'drop-ai-project-repository-test';
const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const SAVED_AT_EPOCH_MILLISECONDS = 1_000;
const PROJECT_DOCUMENT_STORE_NAME = 'project-documents';
const PROJECT_SUMMARY_STORE_NAME = 'project-summaries';
const TRACK_ID = '22222222-2222-4222-8222-222222222222';
const PLUGIN_INSTANCE_ID = '33333333-3333-4333-8333-333333333333';
// fake-indexeddb 6.2.5 타입은 인스턴스 대신 생성자를 요구하므로 실제 함수 계약으로 좁힌다.
const forceCloseDatabaseForTest = forceCloseDatabase as unknown as (database: IDBDatabase) => void;

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

function createProjectDocumentV2({ name = '새 프로젝트', revision = 0 } = {}): ProjectDocumentV2 {
  return {
    ...createProjectDocument({ name, revision }),
    schemaVersion: 2,
    tracks: [
      {
        id: TRACK_ID,
        name: 'Plugin Track',
        volume: 1,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        pluginInstances: [
          {
            id: PLUGIN_INSTANCE_ID,
            manifestId: 'builtin.gain',
            manifestVersion: '1.0.0',
            isEnabled: true,
            parameters: [{ id: 'gain', value: 0.75 }],
          },
        ],
        regions: [],
      },
    ],
  };
}

function waitForRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

async function openRawDatabase(indexedDb: IDBFactory): Promise<IDBDatabase> {
  return waitForRequest(indexedDb.open(DATABASE_NAME));
}

async function putRawProjectDocumentRecord(indexedDb: IDBFactory, record: unknown): Promise<void> {
  const database = await openRawDatabase(indexedDb);
  try {
    const transaction = database.transaction(PROJECT_DOCUMENT_STORE_NAME, 'readwrite');
    transaction.objectStore(PROJECT_DOCUMENT_STORE_NAME).put(record);
    await waitForTransaction(transaction);
  } finally {
    database.close();
  }
}

async function getRawProjectDocumentRecord(indexedDb: IDBFactory, projectId: string): Promise<unknown> {
  const database = await openRawDatabase(indexedDb);
  try {
    const transaction = database.transaction(PROJECT_DOCUMENT_STORE_NAME, 'readonly');
    const completion = waitForTransaction(transaction);
    const record = await waitForRequest(transaction.objectStore(PROJECT_DOCUMENT_STORE_NAME).get(projectId));
    await completion;
    return record;
  } finally {
    database.close();
  }
}

function captureNextOpenedDatabase(indexedDb: IDBFactory): Promise<IDBDatabase> {
  const open = indexedDb.open.bind(indexedDb);

  return new Promise(resolve => {
    indexedDb.open = ((name: string, version?: number) => {
      const request = version === undefined ? open(name) : open(name, version);
      request.addEventListener('success', () => resolve(request.result), { once: true });
      return request;
    }) as IDBFactory['open'];
  });
}

describe('IndexedDbProjectRepository', () => {
  let indexedDb: IDBFactory;
  let repositories: IndexedDbProjectRepository[];

  beforeEach(() => {
    indexedDb = new FakeIDBFactory();
    repositories = [];
  });

  afterEach(async () => {
    await Promise.all(repositories.map(repository => repository.close()));
  });

  function createRepository(now: () => number = () => SAVED_AT_EPOCH_MILLISECONDS): IndexedDbProjectRepository {
    const repository = new IndexedDbProjectRepository({ databaseName: DATABASE_NAME, indexedDb, now });
    repositories.push(repository);
    return repository;
  }

  it('IndexedDB가 없어도 조립은 허용하고 실제 작업에서 사용 불가 오류를 반환한다', async () => {
    const repository = new IndexedDbProjectRepository({ indexedDb: undefined });

    await expect(repository.load(PROJECT_ID)).rejects.toMatchObject({
      code: ProjectRepositoryErrorCode.STORAGE_UNAVAILABLE,
    });
  });

  it('새 Repository 인스턴스에서도 생성한 프로젝트를 불러오고 목록에서 조회한다', async () => {
    const document = createProjectDocument();
    await createRepository().create(document);

    const reopenedRepository = createRepository();

    await expect(reopenedRepository.load(PROJECT_ID)).resolves.toEqual(document);
    await expect(reopenedRepository.list()).resolves.toEqual([
      {
        projectId: PROJECT_ID,
        name: '새 프로젝트',
        revision: 0,
        savedAtEpochMilliseconds: SAVED_AT_EPOCH_MILLISECONDS,
      },
    ]);
  });

  it('새 Repository 인스턴스에서도 v2 Plugin 문서를 버전 그대로 불러온다', async () => {
    const document = createProjectDocumentV2();
    await createRepository().create(document);

    const reopenedRepository = createRepository();

    await expect(reopenedRepository.load(PROJECT_ID)).resolves.toEqual(document);
    await expect(reopenedRepository.list()).resolves.toEqual([
      {
        projectId: PROJECT_ID,
        name: '새 프로젝트',
        revision: 0,
        savedAtEpochMilliseconds: SAVED_AT_EPOCH_MILLISECONDS,
      },
    ]);
  });

  it('v2 문서를 저장하면 revision과 Plugin 상태를 한 transaction에서 갱신한다', async () => {
    const repository = createRepository();
    const document = createProjectDocumentV2();
    await repository.create(document);

    const saved = await repository.save({
      document: createProjectDocumentV2({ name: '편집한 Plugin 프로젝트' }),
      expectedRevision: 0,
    });

    expect(saved).toMatchObject({
      schemaVersion: 2,
      project: { name: '편집한 Plugin 프로젝트', revision: 1 },
      tracks: [{ pluginInstances: [{ id: PLUGIN_INSTANCE_ID }] }],
    });
    await expect(repository.load(PROJECT_ID)).resolves.toEqual(saved);
  });

  it('서로 다른 Repository 인스턴스에서도 중복 프로젝트 생성을 거부한다', async () => {
    const document = createProjectDocument();
    await createRepository().create(document);

    await expect(createRepository().create(document)).rejects.toMatchObject({
      code: ProjectRepositoryErrorCode.PROJECT_ALREADY_EXISTS,
    });
  });

  it('문서와 목록 요약을 한 revision과 저장 시각으로 함께 갱신한다', async () => {
    let currentTime = SAVED_AT_EPOCH_MILLISECONDS;
    const repository = createRepository(() => currentTime);
    const document = createProjectDocument();
    await repository.create(document);
    currentTime = 2_000;

    const saved = await repository.save({
      document: createProjectDocument({ name: '편집한 프로젝트' }),
      expectedRevision: 0,
    });

    expect(saved.project).toEqual({ id: PROJECT_ID, name: '편집한 프로젝트', revision: 1 });
    await expect(repository.list()).resolves.toEqual([
      {
        projectId: PROJECT_ID,
        name: '편집한 프로젝트',
        revision: 1,
        savedAtEpochMilliseconds: 2_000,
      },
    ]);
  });

  it('같은 revision의 동시 저장 중 하나만 성공시킨다', async () => {
    const firstRepository = createRepository();
    const secondRepository = createRepository();
    const document = createProjectDocument();
    await firstRepository.create(document);
    await Promise.all([firstRepository.load(PROJECT_ID), secondRepository.load(PROJECT_ID)]);

    const results = await Promise.allSettled([
      firstRepository.save({ document: createProjectDocument({ name: '첫 번째 편집' }), expectedRevision: 0 }),
      secondRepository.save({ document: createProjectDocument({ name: '두 번째 편집' }), expectedRevision: 0 }),
    ]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toEqual([
      expect.objectContaining({
        reason: expect.objectContaining({ code: ProjectRepositoryErrorCode.REVISION_CONFLICT }),
      }),
    ]);
  });

  it('요약 저장이 실패하면 같은 transaction의 문서 저장도 취소한다', async () => {
    const repository = createRepository();
    await repository.load(PROJECT_ID);
    const database = await openRawDatabase(indexedDb);
    const transaction = database.transaction(PROJECT_SUMMARY_STORE_NAME, 'readwrite');
    transaction.objectStore(PROJECT_SUMMARY_STORE_NAME).add({
      projectId: PROJECT_ID,
      name: '고아 요약',
      revision: 0,
      savedAtEpochMilliseconds: SAVED_AT_EPOCH_MILLISECONDS,
    });
    await waitForTransaction(transaction);
    database.close();

    await expect(repository.create(createProjectDocument())).rejects.toMatchObject({
      code: ProjectRepositoryErrorCode.STORAGE_OPERATION_FAILED,
    });
    await expect(repository.load(PROJECT_ID)).resolves.toBeNull();
  });

  it('최신 revision으로 삭제하면 문서와 목록 요약을 모두 삭제한다', async () => {
    const repository = createRepository();
    await repository.create(createProjectDocument());

    await expect(repository.delete({ projectId: PROJECT_ID, expectedRevision: 1 })).rejects.toMatchObject({
      code: ProjectRepositoryErrorCode.REVISION_CONFLICT,
    });
    await repository.delete({ projectId: PROJECT_ID, expectedRevision: 0 });

    await expect(repository.load(PROJECT_ID)).resolves.toBeNull();
    await expect(repository.list()).resolves.toEqual([]);
  });

  it('저장소 안의 잘못된 문서를 별도 오류로 분류한다', async () => {
    const repository = createRepository();
    await repository.load(PROJECT_ID);
    await putRawProjectDocumentRecord(indexedDb, { projectId: PROJECT_ID, document: {} });

    await expect(repository.load(PROJECT_ID)).rejects.toMatchObject({
      code: ProjectRepositoryErrorCode.INVALID_STORED_DATA,
      cause: {
        name: 'ProjectDocumentReadError',
        code: 'INVALID_DOCUMENT_HEADER',
      },
    });
  });

  it('저장소 안의 미래 문서 버전을 손상된 데이터와 구분한다', async () => {
    const repository = createRepository();
    await repository.load(PROJECT_ID);
    await putRawProjectDocumentRecord(indexedDb, {
      projectId: PROJECT_ID,
      document: { ...createProjectDocument(), schemaVersion: 16 },
    });

    await expect(repository.load(PROJECT_ID)).rejects.toMatchObject({
      code: ProjectRepositoryErrorCode.UNSUPPORTED_STORED_DOCUMENT_SCHEMA_VERSION,
      details: { projectId: PROJECT_ID, schemaVersion: 16 },
      cause: {
        name: 'ProjectDocumentReadError',
        code: 'UNSUPPORTED_SCHEMA_VERSION',
      },
    });
  });

  it('document 필드가 없는 저장 record를 envelope 손상으로 분류한다', async () => {
    const repository = createRepository();
    await repository.load(PROJECT_ID);
    await putRawProjectDocumentRecord(indexedDb, { projectId: PROJECT_ID });

    await expect(repository.load(PROJECT_ID)).rejects.toMatchObject({
      code: ProjectRepositoryErrorCode.INVALID_STORED_DATA,
      cause: { name: 'ZodError' },
    });
  });

  it('저장 키와 문서 안의 프로젝트 ID가 다르면 손상된 데이터로 분류한다', async () => {
    const repository = createRepository();
    await repository.load(PROJECT_ID);
    const document = createProjectDocument();
    document.project.id = '77777777-7777-4777-8777-777777777777';
    await putRawProjectDocumentRecord(indexedDb, { projectId: PROJECT_ID, document });

    await expect(repository.load(PROJECT_ID)).rejects.toMatchObject({
      code: ProjectRepositoryErrorCode.INVALID_STORED_DATA,
      details: {
        documentProjectId: '77777777-7777-4777-8777-777777777777',
        projectId: PROJECT_ID,
      },
    });
  });

  it('미래 문서 버전을 save로 덮어쓰지 않는다', async () => {
    const repository = createRepository();
    await repository.load(PROJECT_ID);
    const futureDocument = { ...createProjectDocument(), schemaVersion: 16 };
    await putRawProjectDocumentRecord(indexedDb, { projectId: PROJECT_ID, document: futureDocument });

    await expect(repository.save({ document: createProjectDocument(), expectedRevision: 0 })).rejects.toMatchObject({
      code: ProjectRepositoryErrorCode.UNSUPPORTED_STORED_DOCUMENT_SCHEMA_VERSION,
    });
    await expect(getRawProjectDocumentRecord(indexedDb, PROJECT_ID)).resolves.toEqual({
      projectId: PROJECT_ID,
      document: futureDocument,
    });
  });

  it('저장소 안의 잘못된 목록 요약을 별도 오류로 분류한다', async () => {
    const repository = createRepository();
    await repository.load(PROJECT_ID);
    const database = await openRawDatabase(indexedDb);
    const transaction = database.transaction(PROJECT_SUMMARY_STORE_NAME, 'readwrite');
    transaction.objectStore(PROJECT_SUMMARY_STORE_NAME).put({ projectId: PROJECT_ID, name: '' });
    await waitForTransaction(transaction);
    database.close();

    await expect(repository.list()).rejects.toMatchObject({
      code: ProjectRepositoryErrorCode.INVALID_STORED_DATA,
    });
  });

  it('유효하지 않은 저장 시각이면 문서를 공개하지 않는다', async () => {
    const repository = createRepository(() => Number.NaN);

    await expect(repository.create(createProjectDocument())).rejects.toMatchObject({
      code: ProjectRepositoryErrorCode.STORAGE_OPERATION_FAILED,
    });
    await expect(repository.load(PROJECT_ID)).resolves.toBeNull();
  });

  it('잘못된 입력과 존재하지 않는 프로젝트를 계약 오류로 분류한다', async () => {
    const repository = createRepository();
    const invalidDocument = { ...createProjectDocument(), unexpected: true } as ProjectDocument;

    await expect(repository.create(invalidDocument)).rejects.toMatchObject({
      code: ProjectRepositoryErrorCode.INVALID_DOCUMENT,
    });
    await expect(
      repository.save({ document: createProjectDocument(), expectedRevision: Number.MAX_SAFE_INTEGER })
    ).rejects.toMatchObject({ code: ProjectRepositoryErrorCode.INVALID_EXPECTED_REVISION });
    await expect(repository.delete({ projectId: PROJECT_ID, expectedRevision: 0 })).rejects.toMatchObject({
      code: ProjectRepositoryErrorCode.PROJECT_NOT_FOUND,
    });
  });

  it('close 이후 같은 인스턴스에서 연결을 다시 연다', async () => {
    const repository = createRepository();
    const document = createProjectDocument();
    await repository.create(document);
    await repository.close();

    await expect(repository.load(PROJECT_ID)).resolves.toEqual(document);
  });

  it('비정상 연결 종료 이후 같은 인스턴스에서 자동으로 다시 연결한다', async () => {
    const openedDatabase = captureNextOpenedDatabase(indexedDb);
    const repository = createRepository();
    const document = createProjectDocument();
    await repository.create(document);
    const database = await openedDatabase;

    forceCloseDatabaseForTest(database);

    await expect(repository.load(PROJECT_ID)).resolves.toEqual(document);
  });
});
