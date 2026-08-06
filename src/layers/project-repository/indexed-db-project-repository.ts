import { z } from 'zod';
import type { ProjectDocumentSnapshot } from '../shared/types/project-document.schema';
import { ProjectRepositoryError, ProjectRepositoryErrorCode } from './errors';
import type {
  CommitLocalProjectRequest,
  CommittedLocalProjectChange,
  DeleteProjectRequest,
  ILocalFirstProjectRepository,
  ListPendingProjectChangesRequest,
  ProjectOutboxEntry,
  ProjectSummary,
  SaveProjectRequest,
  ScheduleProjectChangeRetryRequest,
} from './i-project-repository';
import {
  cloneAndValidateProjectDocument,
  readStoredProjectDocument,
  throwIfRevisionConflict,
  validateExpectedRevision,
  validateInitialRevision,
  validateSaveExpectedRevision,
} from './project-repository-validation';

const DATABASE_VERSION = 2;
const DEFAULT_DATABASE_NAME = 'drop-ai-projects';
const PROJECT_DOCUMENT_STORE_NAME = 'project-documents';
const PROJECT_SUMMARY_STORE_NAME = 'project-summaries';
const PROJECT_OUTBOX_STORE_NAME = 'project-outbox';
const PROJECT_OUTBOX_PROJECT_ID_INDEX_NAME = 'projectId';
const PROJECT_STORE_NAMES = [PROJECT_DOCUMENT_STORE_NAME, PROJECT_SUMMARY_STORE_NAME];
const LOCAL_COMMIT_STORE_NAMES = [...PROJECT_STORE_NAMES, PROJECT_OUTBOX_STORE_NAME];
const DEFAULT_OUTBOX_QUERY_LIMIT = 100;
const MAX_OUTBOX_QUERY_LIMIT = 1_000;

const OperationIdSchema = z.uuid('Invalid operation ID format');
const EpochMillisecondsSchema = z.number().int().nonnegative();

const StoredProjectDocumentEnvelopeSchema = z.strictObject({
  projectId: z.uuid(),
  document: z.unknown().refine(document => document !== undefined, {
    message: '저장 record의 document 필드가 필요합니다.',
  }),
});

const StoredProjectSummarySchema = z.strictObject({
  projectId: z.uuid(),
  name: z.string().trim().min(1).max(255),
  revision: z.number().int().nonnegative(),
  savedAtEpochMilliseconds: z.number().int().nonnegative(),
});

const StoredProjectOutboxEntrySchema = z.strictObject({
  operationId: z.uuid(),
  projectId: z.uuid(),
  baseRevision: z.number().int().nonnegative().nullable(),
  localRevision: z.number().int().nonnegative(),
  document: z.unknown().refine(document => document !== undefined, {
    message: 'Outbox record의 document 필드가 필요합니다.',
  }),
  createdAtEpochMilliseconds: EpochMillisecondsSchema,
  attemptCount: z.number().int().nonnegative(),
  nextAttemptAtEpochMilliseconds: EpochMillisecondsSchema,
});

interface IndexedDbProjectRepositoryOptions {
  readonly indexedDb?: IDBFactory;
  readonly databaseName?: string;
  readonly now?: () => number;
}

interface TransactionExecutionContext<T> {
  readonly transaction: IDBTransaction;
  readonly setResult: (result: T) => void;
  readonly abortWith: (error: unknown) => void;
}

interface RunTransactionOptions<T> {
  readonly mode: IDBTransactionMode;
  readonly operation: string;
  readonly storeNames: string | string[];
  readonly execute: (context: TransactionExecutionContext<T>) => void;
}

export class IndexedDbProjectRepository implements ILocalFirstProjectRepository {
  private readonly indexedDb: IDBFactory | undefined;
  private readonly databaseName: string;
  private readonly now: () => number;
  private connectionPromise?: Promise<IDBDatabase>;

  constructor({
    indexedDb,
    databaseName = DEFAULT_DATABASE_NAME,
    now = Date.now,
  }: IndexedDbProjectRepositoryOptions = {}) {
    this.indexedDb = indexedDb ?? globalThis.indexedDB;
    this.databaseName = databaseName;
    this.now = now;
  }

  async create(document: ProjectDocumentSnapshot): Promise<ProjectDocumentSnapshot> {
    const validatedDocument = cloneAndValidateProjectDocument(document);
    validateInitialRevision(validatedDocument);
    const projectId = validatedDocument.project.id;
    const summary = this.createProjectSummary(validatedDocument);

    return this.runTransaction({
      mode: 'readwrite',
      operation: 'create',
      storeNames: PROJECT_STORE_NAMES,
      execute: ({ transaction, setResult, abortWith }) => {
        const documentStore = transaction.objectStore(PROJECT_DOCUMENT_STORE_NAME);
        const summaryStore = transaction.objectStore(PROJECT_SUMMARY_STORE_NAME);
        const request = documentStore.get(projectId);

        request.onsuccess = () => {
          try {
            if (request.result !== undefined) {
              throw new ProjectRepositoryError({
                code: ProjectRepositoryErrorCode.PROJECT_ALREADY_EXISTS,
                message: `이미 존재하는 프로젝트입니다: ${projectId}`,
                details: { projectId },
              });
            }

            documentStore.add({ projectId, document: validatedDocument });
            summaryStore.add(summary);
            setResult(cloneAndValidateProjectDocument(validatedDocument));
          } catch (error) {
            abortWith(error);
          }
        };
      },
    });
  }

  async save({ document, expectedRevision }: SaveProjectRequest): Promise<ProjectDocumentSnapshot> {
    validateSaveExpectedRevision(expectedRevision);
    const validatedDocument = cloneAndValidateProjectDocument(document);
    const projectId = validatedDocument.project.id;

    return this.runTransaction({
      mode: 'readwrite',
      operation: 'save',
      storeNames: PROJECT_STORE_NAMES,
      execute: ({ transaction, setResult, abortWith }) => {
        const documentStore = transaction.objectStore(PROJECT_DOCUMENT_STORE_NAME);
        const summaryStore = transaction.objectStore(PROJECT_SUMMARY_STORE_NAME);
        const request = documentStore.get(projectId);

        request.onsuccess = () => {
          try {
            if (request.result === undefined) {
              throw this.createProjectNotFoundError(projectId);
            }

            const storedDocument = this.parseStoredProjectDocument(request.result, projectId);
            throwIfRevisionConflict({
              projectId,
              expectedRevision,
              documentRevision: validatedDocument.project.revision,
              storedRevision: storedDocument.project.revision,
            });

            const nextDocument = cloneAndValidateProjectDocument({
              ...validatedDocument,
              project: {
                ...validatedDocument.project,
                revision: expectedRevision + 1,
              },
            });
            documentStore.put({ projectId, document: nextDocument });
            summaryStore.put(this.createProjectSummary(nextDocument));
            setResult(cloneAndValidateProjectDocument(nextDocument));
          } catch (error) {
            abortWith(error);
          }
        };
      },
    });
  }

  async commitLocal({
    document,
    expectedRevision,
    operationId,
  }: CommitLocalProjectRequest): Promise<CommittedLocalProjectChange> {
    validateSaveExpectedRevision(expectedRevision);
    const validatedOperationId = this.validateOperationId(operationId);
    const validatedDocument = cloneAndValidateProjectDocument(document);
    const projectId = validatedDocument.project.id;

    // 문서만 저장되고 Outbox가 누락되는 종료 시점 장애를 막기 위해 세 store를 한 transaction으로 묶는다.
    return this.runTransaction({
      mode: 'readwrite',
      operation: 'commit-local',
      storeNames: LOCAL_COMMIT_STORE_NAMES,
      execute: ({ transaction, setResult, abortWith }) => {
        const documentStore = transaction.objectStore(PROJECT_DOCUMENT_STORE_NAME);
        const summaryStore = transaction.objectStore(PROJECT_SUMMARY_STORE_NAME);
        const outboxStore = transaction.objectStore(PROJECT_OUTBOX_STORE_NAME);
        const request = documentStore.get(projectId);

        request.onsuccess = () => {
          try {
            const storedDocument =
              request.result === undefined ? null : this.parseStoredProjectDocument(request.result, projectId);
            const nextDocument = this.createNextLocalDocument({
              document: validatedDocument,
              expectedRevision,
              storedDocument,
            });
            const outboxEntry = this.createProjectOutboxEntry({
              baseRevision: storedDocument?.project.revision ?? null,
              document: nextDocument,
              operationId: validatedOperationId,
            });

            documentStore.put({ projectId, document: nextDocument });
            summaryStore.put(this.createProjectSummary(nextDocument));
            outboxStore.add(outboxEntry);
            setResult({
              document: cloneAndValidateProjectDocument(nextDocument),
              outboxEntry: this.cloneProjectOutboxEntry(outboxEntry),
            });
          } catch (error) {
            abortWith(error);
          }
        };
      },
    });
  }

  async listPendingChanges({
    projectId,
    dueAtEpochMilliseconds,
    limit = DEFAULT_OUTBOX_QUERY_LIMIT,
  }: ListPendingProjectChangesRequest): Promise<readonly ProjectOutboxEntry[]> {
    const validatedProjectId = projectId === undefined ? undefined : this.validateProjectId(projectId);
    const validatedDueAt = this.validateOutboxQueryNumber('dueAtEpochMilliseconds', dueAtEpochMilliseconds);
    const validatedLimit = this.validateOutboxQueryLimit(limit);

    return this.runTransaction({
      mode: 'readonly',
      operation: 'list-pending-changes',
      storeNames: PROJECT_OUTBOX_STORE_NAME,
      execute: ({ transaction, setResult, abortWith }) => {
        const outboxStore = transaction.objectStore(PROJECT_OUTBOX_STORE_NAME);
        const request = validatedProjectId
          ? outboxStore.index(PROJECT_OUTBOX_PROJECT_ID_INDEX_NAME).getAll(validatedProjectId)
          : outboxStore.getAll();
        request.onsuccess = () => {
          try {
            const pendingChanges = request.result
              .map(value => this.parseStoredProjectOutboxEntry(value))
              .filter(entry => entry.nextAttemptAtEpochMilliseconds <= validatedDueAt)
              .sort((left, right) => {
                const createdAtDifference = left.createdAtEpochMilliseconds - right.createdAtEpochMilliseconds;
                if (createdAtDifference !== 0) {
                  return createdAtDifference;
                }
                const projectIdDifference = left.projectId.localeCompare(right.projectId);
                if (projectIdDifference !== 0) {
                  return projectIdDifference;
                }
                const revisionDifference = left.localRevision - right.localRevision;
                return revisionDifference === 0
                  ? left.operationId.localeCompare(right.operationId)
                  : revisionDifference;
              })
              .slice(0, validatedLimit);
            setResult(pendingChanges);
          } catch (error) {
            abortWith(error);
          }
        };
      },
    });
  }

  async acknowledgePendingChange(operationId: string): Promise<void> {
    const validatedOperationId = this.validateOperationId(operationId);

    return this.runTransaction({
      mode: 'readwrite',
      operation: 'acknowledge-pending-change',
      storeNames: PROJECT_OUTBOX_STORE_NAME,
      execute: ({ transaction, setResult }) => {
        transaction.objectStore(PROJECT_OUTBOX_STORE_NAME).delete(validatedOperationId);
        setResult(undefined);
      },
    });
  }

  async schedulePendingChangeRetry({
    operationId,
    nextAttemptAtEpochMilliseconds,
  }: ScheduleProjectChangeRetryRequest): Promise<void> {
    const validatedOperationId = this.validateOperationId(operationId);
    const validatedNextAttemptAt = this.validateOutboxQueryNumber(
      'nextAttemptAtEpochMilliseconds',
      nextAttemptAtEpochMilliseconds
    );

    return this.runTransaction({
      mode: 'readwrite',
      operation: 'schedule-pending-change-retry',
      storeNames: PROJECT_OUTBOX_STORE_NAME,
      execute: ({ transaction, setResult, abortWith }) => {
        const outboxStore = transaction.objectStore(PROJECT_OUTBOX_STORE_NAME);
        const request = outboxStore.get(validatedOperationId);
        request.onsuccess = () => {
          try {
            if (request.result === undefined) {
              throw new ProjectRepositoryError({
                code: ProjectRepositoryErrorCode.OUTBOX_ENTRY_NOT_FOUND,
                message: `재시도할 프로젝트 변경을 찾을 수 없습니다: ${validatedOperationId}`,
                details: { operationId: validatedOperationId },
              });
            }
            const storedEntry = this.parseStoredProjectOutboxEntry(request.result);
            outboxStore.put({
              ...storedEntry,
              attemptCount: storedEntry.attemptCount + 1,
              nextAttemptAtEpochMilliseconds: validatedNextAttemptAt,
            });
            setResult(undefined);
          } catch (error) {
            abortWith(error);
          }
        };
      },
    });
  }

  async load(projectId: string): Promise<ProjectDocumentSnapshot | null> {
    return this.runTransaction({
      mode: 'readonly',
      operation: 'load',
      storeNames: PROJECT_DOCUMENT_STORE_NAME,
      execute: ({ transaction, setResult, abortWith }) => {
        const request = transaction.objectStore(PROJECT_DOCUMENT_STORE_NAME).get(projectId);
        request.onsuccess = () => {
          try {
            const document =
              request.result === undefined ? null : this.parseStoredProjectDocument(request.result, projectId);
            setResult(document);
          } catch (error) {
            abortWith(error);
          }
        };
      },
    });
  }

  async list(): Promise<readonly ProjectSummary[]> {
    return this.runTransaction({
      mode: 'readonly',
      operation: 'list',
      storeNames: PROJECT_SUMMARY_STORE_NAME,
      execute: ({ transaction, setResult, abortWith }) => {
        const request = transaction.objectStore(PROJECT_SUMMARY_STORE_NAME).getAll();
        request.onsuccess = () => {
          try {
            setResult(request.result.map(summary => this.parseStoredProjectSummary(summary)));
          } catch (error) {
            abortWith(error);
          }
        };
      },
    });
  }

  async delete({ projectId, expectedRevision }: DeleteProjectRequest): Promise<void> {
    validateExpectedRevision(expectedRevision);

    return this.runTransaction({
      mode: 'readwrite',
      operation: 'delete',
      storeNames: LOCAL_COMMIT_STORE_NAMES,
      execute: ({ transaction, setResult, abortWith }) => {
        const documentStore = transaction.objectStore(PROJECT_DOCUMENT_STORE_NAME);
        const summaryStore = transaction.objectStore(PROJECT_SUMMARY_STORE_NAME);
        const request = documentStore.get(projectId);

        request.onsuccess = () => {
          try {
            if (request.result === undefined) {
              throw this.createProjectNotFoundError(projectId);
            }

            const storedDocument = this.parseStoredProjectDocument(request.result, projectId);
            const storedRevision = storedDocument.project.revision;
            if (storedRevision !== expectedRevision) {
              throw new ProjectRepositoryError({
                code: ProjectRepositoryErrorCode.REVISION_CONFLICT,
                message: `프로젝트 revision이 변경되었습니다: ${projectId}`,
                details: { projectId, expectedRevision, storedRevision },
              });
            }

            documentStore.delete(projectId);
            summaryStore.delete(projectId);
            const outboxIndex = transaction
              .objectStore(PROJECT_OUTBOX_STORE_NAME)
              .index(PROJECT_OUTBOX_PROJECT_ID_INDEX_NAME);
            const outboxCursorRequest = outboxIndex.openCursor(projectId);
            outboxCursorRequest.onsuccess = () => {
              const cursor = outboxCursorRequest.result;
              if (!cursor) {
                return;
              }
              cursor.delete();
              cursor.continue();
            };
            setResult(undefined);
          } catch (error) {
            abortWith(error);
          }
        };
      },
    });
  }

  async close(): Promise<void> {
    const connectionPromise = this.connectionPromise;
    this.connectionPromise = undefined;
    if (!connectionPromise) {
      return;
    }

    const database = await connectionPromise.catch(() => null);
    database?.close();
  }

  private async runTransaction<T>({ mode, operation, storeNames, execute }: RunTransactionOptions<T>): Promise<T> {
    const database = await this.getDatabase();

    return new Promise((resolve, reject) => {
      let transaction: IDBTransaction;
      try {
        transaction = database.transaction(storeNames, mode);
      } catch (error) {
        reject(this.createStorageOperationError(operation, error));
        return;
      }

      let hasResult = false;
      let result: T;
      let operationError: ProjectRepositoryError | undefined;

      const abortWith = (error: unknown): void => {
        operationError =
          error instanceof ProjectRepositoryError ? error : this.createStorageOperationError(operation, error);
        try {
          transaction.abort();
        } catch {
          reject(operationError);
        }
      };

      transaction.oncomplete = () => {
        if (!hasResult) {
          reject(this.createStorageOperationError(operation, new Error('Transaction result is missing')));
          return;
        }

        resolve(result);
      };
      transaction.onabort = () => {
        reject(operationError ?? this.createStorageOperationError(operation, transaction.error));
      };

      try {
        execute({
          transaction,
          setResult: value => {
            result = value;
            hasResult = true;
          },
          abortWith,
        });
      } catch (error) {
        abortWith(error);
      }
    });
  }

  private getDatabase(): Promise<IDBDatabase> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    const connectionPromise = this.openDatabase(() => {
      if (this.connectionPromise === connectionPromise) {
        this.connectionPromise = undefined;
      }
    });
    this.connectionPromise = connectionPromise;
    void connectionPromise.catch(() => {
      if (this.connectionPromise === connectionPromise) {
        this.connectionPromise = undefined;
      }
    });
    return connectionPromise;
  }

  private openDatabase(onConnectionInvalidated: () => void): Promise<IDBDatabase> {
    const indexedDb = this.indexedDb;
    if (!indexedDb) {
      return Promise.reject(
        new ProjectRepositoryError({
          code: ProjectRepositoryErrorCode.STORAGE_UNAVAILABLE,
          message: '이 환경에서는 IndexedDB를 사용할 수 없습니다.',
        })
      );
    }

    return new Promise((resolve, reject) => {
      let request: IDBOpenDBRequest;
      try {
        request = indexedDb.open(this.databaseName, DATABASE_VERSION);
      } catch (error) {
        reject(this.createStorageOperationError('open', error));
        return;
      }

      let isSettled = false;
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(PROJECT_DOCUMENT_STORE_NAME)) {
          database.createObjectStore(PROJECT_DOCUMENT_STORE_NAME, { keyPath: 'projectId' });
        }
        if (!database.objectStoreNames.contains(PROJECT_SUMMARY_STORE_NAME)) {
          database.createObjectStore(PROJECT_SUMMARY_STORE_NAME, { keyPath: 'projectId' });
        }
        if (!database.objectStoreNames.contains(PROJECT_OUTBOX_STORE_NAME)) {
          const outboxStore = database.createObjectStore(PROJECT_OUTBOX_STORE_NAME, { keyPath: 'operationId' });
          outboxStore.createIndex(PROJECT_OUTBOX_PROJECT_ID_INDEX_NAME, 'projectId', { unique: false });
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        if (isSettled) {
          database.close();
          return;
        }

        isSettled = true;
        database.onversionchange = () => {
          database.close();
          onConnectionInvalidated();
        };
        database.onclose = onConnectionInvalidated;
        resolve(database);
      };
      request.onerror = () => {
        if (isSettled) {
          return;
        }

        isSettled = true;
        reject(this.createStorageOperationError('open', request.error));
      };
      request.onblocked = () => {
        if (isSettled) {
          return;
        }

        isSettled = true;
        reject(
          new ProjectRepositoryError({
            code: ProjectRepositoryErrorCode.STORAGE_UNAVAILABLE,
            message: '다른 탭이 프로젝트 저장소 업그레이드를 막고 있습니다.',
            details: { databaseName: this.databaseName },
          })
        );
      };
    });
  }

  private createProjectSummary(document: ProjectDocumentSnapshot): ProjectSummary {
    const result = StoredProjectSummarySchema.safeParse({
      projectId: document.project.id,
      name: document.project.name,
      revision: document.project.revision,
      savedAtEpochMilliseconds: this.now(),
    });
    if (result.success) {
      return result.data;
    }

    throw this.createStorageOperationError('create-summary', result.error);
  }

  private createNextLocalDocument({
    document,
    expectedRevision,
    storedDocument,
  }: {
    readonly document: ProjectDocumentSnapshot;
    readonly expectedRevision: number;
    readonly storedDocument: ProjectDocumentSnapshot | null;
  }): ProjectDocumentSnapshot {
    if (!storedDocument) {
      validateInitialRevision(document);
      if (expectedRevision !== document.project.revision) {
        throw new ProjectRepositoryError({
          code: ProjectRepositoryErrorCode.REVISION_CONFLICT,
          message: `새 프로젝트 revision과 expectedRevision이 다릅니다: ${document.project.id}`,
          details: {
            documentRevision: document.project.revision,
            expectedRevision,
            projectId: document.project.id,
          },
        });
      }
      return cloneAndValidateProjectDocument(document);
    }

    throwIfRevisionConflict({
      projectId: document.project.id,
      expectedRevision,
      documentRevision: document.project.revision,
      storedRevision: storedDocument.project.revision,
    });
    return cloneAndValidateProjectDocument({
      ...document,
      project: {
        ...document.project,
        revision: expectedRevision + 1,
      },
    });
  }

  private createProjectOutboxEntry({
    baseRevision,
    document,
    operationId,
  }: {
    readonly baseRevision: number | null;
    readonly document: ProjectDocumentSnapshot;
    readonly operationId: string;
  }): ProjectOutboxEntry {
    const createdAtEpochMilliseconds = this.now();
    const result = StoredProjectOutboxEntrySchema.safeParse({
      operationId,
      projectId: document.project.id,
      baseRevision,
      localRevision: document.project.revision,
      document,
      createdAtEpochMilliseconds,
      attemptCount: 0,
      nextAttemptAtEpochMilliseconds: createdAtEpochMilliseconds,
    });
    if (result.success) {
      return this.parseStoredProjectOutboxEntry(result.data);
    }
    throw this.createStorageOperationError('create-outbox-entry', result.error);
  }

  private parseStoredProjectOutboxEntry(value: unknown): ProjectOutboxEntry {
    const result = StoredProjectOutboxEntrySchema.safeParse(value);
    if (!result.success) {
      throw new ProjectRepositoryError({
        code: ProjectRepositoryErrorCode.INVALID_STORED_DATA,
        message: '저장된 프로젝트 Outbox 변경이 유효하지 않습니다.',
        cause: result.error,
      });
    }

    const document = readStoredProjectDocument({
      document: result.data.document,
      projectId: result.data.projectId,
    });
    if (document.project.id !== result.data.projectId || document.project.revision !== result.data.localRevision) {
      throw new ProjectRepositoryError({
        code: ProjectRepositoryErrorCode.INVALID_STORED_DATA,
        message: `Outbox 변경과 프로젝트 문서가 일치하지 않습니다: ${result.data.operationId}`,
        details: { operationId: result.data.operationId },
      });
    }

    return this.cloneProjectOutboxEntry({ ...result.data, document });
  }

  private cloneProjectOutboxEntry(entry: ProjectOutboxEntry): ProjectOutboxEntry {
    return {
      ...entry,
      document: cloneAndValidateProjectDocument(entry.document),
    };
  }

  private validateOperationId(operationId: string): string {
    const result = OperationIdSchema.safeParse(operationId);
    if (result.success) {
      return result.data;
    }
    throw new ProjectRepositoryError({
      code: ProjectRepositoryErrorCode.INVALID_OPERATION_ID,
      message: `프로젝트 변경 operation ID가 유효하지 않습니다: ${operationId}`,
      details: { operationId },
      cause: result.error,
    });
  }

  private validateProjectId(projectId: string): string {
    const result = z.uuid().safeParse(projectId);
    if (result.success) {
      return result.data;
    }
    throw new ProjectRepositoryError({
      code: ProjectRepositoryErrorCode.INVALID_OUTBOX_QUERY,
      message: `Outbox 조회 Project ID가 유효하지 않습니다: ${projectId}`,
      details: { projectId },
      cause: result.error,
    });
  }

  private validateOutboxQueryNumber(field: string, value: number): number {
    const result = EpochMillisecondsSchema.safeParse(value);
    if (result.success) {
      return result.data;
    }
    throw new ProjectRepositoryError({
      code: ProjectRepositoryErrorCode.INVALID_OUTBOX_QUERY,
      message: `Outbox 조회 값이 유효하지 않습니다: ${field}`,
      details: { field, value },
      cause: result.error,
    });
  }

  private validateOutboxQueryLimit(limit: number): number {
    if (Number.isSafeInteger(limit) && limit > 0 && limit <= MAX_OUTBOX_QUERY_LIMIT) {
      return limit;
    }
    throw new ProjectRepositoryError({
      code: ProjectRepositoryErrorCode.INVALID_OUTBOX_QUERY,
      message: `Outbox 조회 limit이 유효하지 않습니다: ${limit}`,
      details: { limit, maxLimit: MAX_OUTBOX_QUERY_LIMIT },
    });
  }

  private parseStoredProjectDocument(value: unknown, expectedProjectId: string): ProjectDocumentSnapshot {
    const envelopeResult = StoredProjectDocumentEnvelopeSchema.safeParse(value);
    if (!envelopeResult.success || envelopeResult.data.projectId !== expectedProjectId) {
      throw new ProjectRepositoryError({
        code: ProjectRepositoryErrorCode.INVALID_STORED_DATA,
        message: `저장된 프로젝트 문서가 유효하지 않습니다: ${expectedProjectId}`,
        details: { projectId: expectedProjectId },
        cause: envelopeResult.success ? undefined : envelopeResult.error,
      });
    }

    const document = readStoredProjectDocument({
      document: envelopeResult.data.document,
      projectId: expectedProjectId,
    });
    if (document.project.id !== expectedProjectId) {
      throw new ProjectRepositoryError({
        code: ProjectRepositoryErrorCode.INVALID_STORED_DATA,
        message: `저장 키와 ProjectDocument ID가 일치하지 않습니다: ${expectedProjectId}`,
        details: { documentProjectId: document.project.id, projectId: expectedProjectId },
      });
    }

    return document;
  }

  private parseStoredProjectSummary(value: unknown): ProjectSummary {
    const result = StoredProjectSummarySchema.safeParse(value);
    if (result.success) {
      return result.data;
    }

    throw new ProjectRepositoryError({
      code: ProjectRepositoryErrorCode.INVALID_STORED_DATA,
      message: '저장된 프로젝트 요약이 유효하지 않습니다.',
      cause: result.error,
    });
  }

  private createProjectNotFoundError(projectId: string): ProjectRepositoryError {
    return new ProjectRepositoryError({
      code: ProjectRepositoryErrorCode.PROJECT_NOT_FOUND,
      message: `프로젝트를 찾을 수 없습니다: ${projectId}`,
      details: { projectId },
    });
  }

  private createStorageOperationError(operation: string, cause: unknown): ProjectRepositoryError {
    const details: Record<string, unknown> = { operation };
    if (cause instanceof Error) {
      details.errorName = cause.name;
    }

    return new ProjectRepositoryError({
      code: ProjectRepositoryErrorCode.STORAGE_OPERATION_FAILED,
      message: `프로젝트 저장소 작업에 실패했습니다: ${operation}`,
      details,
      cause,
    });
  }
}
