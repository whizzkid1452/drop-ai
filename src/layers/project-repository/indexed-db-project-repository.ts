import { z } from 'zod';
import { ProjectDocumentSchema, type ProjectDocument } from '../shared/types/project-document.schema';
import { ProjectRepositoryError, ProjectRepositoryErrorCode } from './errors';
import type {
  DeleteProjectRequest,
  IProjectRepository,
  ProjectSummary,
  SaveProjectRequest,
} from './i-project-repository';
import {
  cloneAndValidateProjectDocument,
  cloneAndValidateStoredProjectDocument,
  throwIfRevisionConflict,
  validateExpectedRevision,
  validateInitialRevision,
  validateSaveExpectedRevision,
} from './project-repository-validation';

const DATABASE_VERSION = 1;
const DEFAULT_DATABASE_NAME = 'drop-ai-projects';
const PROJECT_DOCUMENT_STORE_NAME = 'project-documents';
const PROJECT_SUMMARY_STORE_NAME = 'project-summaries';
const PROJECT_STORE_NAMES = [PROJECT_DOCUMENT_STORE_NAME, PROJECT_SUMMARY_STORE_NAME];

const StoredProjectDocumentSchema = z
  .strictObject({
    projectId: z.uuid(),
    document: ProjectDocumentSchema,
  })
  .refine(record => record.projectId === record.document.project.id, {
    message: '저장 키와 ProjectDocument ID가 일치하지 않습니다.',
  });

const StoredProjectSummarySchema = z.strictObject({
  projectId: z.uuid(),
  name: z.string().trim().min(1).max(255),
  revision: z.number().int().nonnegative(),
  savedAtEpochMilliseconds: z.number().int().nonnegative(),
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

export class IndexedDbProjectRepository implements IProjectRepository {
  private readonly indexedDb: IDBFactory;
  private readonly databaseName: string;
  private readonly now: () => number;
  private connectionPromise?: Promise<IDBDatabase>;

  constructor({
    indexedDb,
    databaseName = DEFAULT_DATABASE_NAME,
    now = Date.now,
  }: IndexedDbProjectRepositoryOptions = {}) {
    const availableIndexedDb = indexedDb ?? globalThis.indexedDB;
    if (!availableIndexedDb) {
      throw new ProjectRepositoryError({
        code: ProjectRepositoryErrorCode.STORAGE_UNAVAILABLE,
        message: '이 환경에서는 IndexedDB를 사용할 수 없습니다.',
      });
    }

    this.indexedDb = availableIndexedDb;
    this.databaseName = databaseName;
    this.now = now;
  }

  async create(document: ProjectDocument): Promise<ProjectDocument> {
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

  async save({ document, expectedRevision }: SaveProjectRequest): Promise<ProjectDocument> {
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

  async load(projectId: string): Promise<ProjectDocument | null> {
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
    return new Promise((resolve, reject) => {
      let request: IDBOpenDBRequest;
      try {
        request = this.indexedDb.open(this.databaseName, DATABASE_VERSION);
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

  private createProjectSummary(document: ProjectDocument): ProjectSummary {
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

  private parseStoredProjectDocument(value: unknown, expectedProjectId: string): ProjectDocument {
    const result = StoredProjectDocumentSchema.safeParse(value);
    if (!result.success || result.data.projectId !== expectedProjectId) {
      throw new ProjectRepositoryError({
        code: ProjectRepositoryErrorCode.INVALID_STORED_DATA,
        message: `저장된 프로젝트 문서가 유효하지 않습니다: ${expectedProjectId}`,
        details: { projectId: expectedProjectId },
        cause: result.success ? undefined : result.error,
      });
    }

    return cloneAndValidateStoredProjectDocument(result.data.document);
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
