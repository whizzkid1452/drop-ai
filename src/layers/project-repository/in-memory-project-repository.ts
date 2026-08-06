import { z } from 'zod';
import { createProjectCrdtCommit } from '../project-crdt/project-crdt-commit';
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
  throwIfRevisionConflict,
  validateExpectedRevision,
  validateInitialRevision,
  validateSaveExpectedRevision,
} from './project-repository-validation';

interface InMemoryProjectRepositoryOptions {
  now?: () => number;
}

interface StoredProject {
  document: ProjectDocumentSnapshot;
  savedAtEpochMilliseconds: number;
  crdtStateBase64?: string;
}

export class InMemoryProjectRepository implements ILocalFirstProjectRepository {
  private readonly projects = new Map<string, StoredProject>();
  private readonly pendingChanges = new Map<string, ProjectOutboxEntry>();
  private readonly now: () => number;

  constructor({ now = Date.now }: InMemoryProjectRepositoryOptions = {}) {
    this.now = now;
  }

  async create(document: ProjectDocumentSnapshot): Promise<ProjectDocumentSnapshot> {
    const validatedDocument = cloneAndValidateProjectDocument(document);
    validateInitialRevision(validatedDocument);
    const { id: projectId } = validatedDocument.project;

    if (this.projects.has(projectId)) {
      throw new ProjectRepositoryError({
        code: ProjectRepositoryErrorCode.PROJECT_ALREADY_EXISTS,
        message: `이미 존재하는 프로젝트입니다: ${projectId}`,
        details: { projectId },
      });
    }

    this.projects.set(projectId, {
      document: validatedDocument,
      savedAtEpochMilliseconds: this.now(),
    });

    return cloneAndValidateProjectDocument(validatedDocument);
  }

  async save({ document, expectedRevision }: SaveProjectRequest): Promise<ProjectDocumentSnapshot> {
    validateSaveExpectedRevision(expectedRevision);
    const validatedDocument = cloneAndValidateProjectDocument(document);
    const projectId = validatedDocument.project.id;
    const storedProject = this.getStoredProject(projectId);

    throwIfRevisionConflict({
      projectId,
      expectedRevision,
      documentRevision: validatedDocument.project.revision,
      storedRevision: storedProject.document.project.revision,
    });

    const nextDocument = cloneAndValidateProjectDocument({
      ...validatedDocument,
      project: {
        ...validatedDocument.project,
        revision: expectedRevision + 1,
      },
    });
    this.projects.set(projectId, {
      document: nextDocument,
      savedAtEpochMilliseconds: this.now(),
    });

    return cloneAndValidateProjectDocument(nextDocument);
  }

  async commitLocal({
    document,
    expectedRevision,
    operationId,
  }: CommitLocalProjectRequest): Promise<CommittedLocalProjectChange> {
    const operationIdResult = z.uuid().safeParse(operationId);
    if (!operationIdResult.success) {
      throw new ProjectRepositoryError({
        code: ProjectRepositoryErrorCode.INVALID_OPERATION_ID,
        message: `프로젝트 변경 operation ID가 유효하지 않습니다: ${operationId}`,
        details: { operationId },
        cause: operationIdResult.error,
      });
    }
    if (this.pendingChanges.has(operationIdResult.data)) {
      throw new ProjectRepositoryError({
        code: ProjectRepositoryErrorCode.STORAGE_OPERATION_FAILED,
        message: `이미 존재하는 프로젝트 변경 operation ID입니다: ${operationId}`,
        details: { operationId },
      });
    }

    const validatedDocument = cloneAndValidateProjectDocument(document);
    const storedProject = this.projects.get(validatedDocument.project.id);
    let committedDocument: ProjectDocumentSnapshot;
    let baseRevision: number | null;

    if (!storedProject) {
      validateInitialRevision(validatedDocument);
      if (validatedDocument.project.revision !== expectedRevision) {
        throw new ProjectRepositoryError({
          code: ProjectRepositoryErrorCode.REVISION_CONFLICT,
          message: `새 프로젝트 revision과 expectedRevision이 다릅니다: ${validatedDocument.project.id}`,
          details: { documentRevision: validatedDocument.project.revision, expectedRevision },
        });
      }
      committedDocument = validatedDocument;
      baseRevision = null;
    } else {
      throwIfRevisionConflict({
        projectId: validatedDocument.project.id,
        expectedRevision,
        documentRevision: validatedDocument.project.revision,
        storedRevision: storedProject.document.project.revision,
      });
      committedDocument = cloneAndValidateProjectDocument({
        ...validatedDocument,
        project: { ...validatedDocument.project, revision: expectedRevision + 1 },
      });
      baseRevision = storedProject.document.project.revision;
    }

    const createdAtEpochMilliseconds = this.now();
    const crdtCommit = createProjectCrdtCommit({
      previousDocument: storedProject?.document ?? null,
      previousStateBase64: storedProject?.crdtStateBase64,
      nextDocument: committedDocument,
    });
    const outboxEntry: ProjectOutboxEntry = {
      operationId: operationIdResult.data,
      projectId: committedDocument.project.id,
      baseRevision,
      localRevision: committedDocument.project.revision,
      document: cloneAndValidateProjectDocument(committedDocument),
      crdtUpdateBase64: crdtCommit.updateBase64,
      createdAtEpochMilliseconds,
      attemptCount: 0,
      nextAttemptAtEpochMilliseconds: createdAtEpochMilliseconds,
    };
    this.projects.set(committedDocument.project.id, {
      document: committedDocument,
      savedAtEpochMilliseconds: createdAtEpochMilliseconds,
      crdtStateBase64: crdtCommit.stateBase64,
    });
    this.pendingChanges.set(outboxEntry.operationId, outboxEntry);

    return {
      document: cloneAndValidateProjectDocument(committedDocument),
      outboxEntry: this.cloneOutboxEntry(outboxEntry),
    };
  }

  async listPendingChanges({
    projectId,
    dueAtEpochMilliseconds,
    limit = 100,
  }: ListPendingProjectChangesRequest): Promise<readonly ProjectOutboxEntry[]> {
    if (!Number.isSafeInteger(dueAtEpochMilliseconds) || dueAtEpochMilliseconds < 0) {
      throw this.createInvalidOutboxQueryError('dueAtEpochMilliseconds', dueAtEpochMilliseconds);
    }
    if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 1_000) {
      throw this.createInvalidOutboxQueryError('limit', limit);
    }
    if (projectId !== undefined && !z.uuid().safeParse(projectId).success) {
      throw this.createInvalidOutboxQueryError('projectId', projectId);
    }

    return [...this.pendingChanges.values()]
      .filter(entry => entry.nextAttemptAtEpochMilliseconds <= dueAtEpochMilliseconds)
      .filter(entry => projectId === undefined || entry.projectId === projectId)
      .sort((left, right) => {
        if (left.projectId === right.projectId) {
          const revisionDifference = left.localRevision - right.localRevision;
          if (revisionDifference !== 0) {
            return revisionDifference;
          }
          return left.operationId.localeCompare(right.operationId);
        }
        const createdAtDifference = left.createdAtEpochMilliseconds - right.createdAtEpochMilliseconds;
        if (createdAtDifference !== 0) {
          return createdAtDifference;
        }
        return left.projectId.localeCompare(right.projectId);
      })
      .slice(0, limit)
      .map(entry => this.cloneOutboxEntry(entry));
  }

  async acknowledgePendingChange(operationId: string): Promise<void> {
    this.validateOperationId(operationId);
    this.pendingChanges.delete(operationId);
  }

  async schedulePendingChangeRetry({
    operationId,
    nextAttemptAtEpochMilliseconds,
  }: ScheduleProjectChangeRetryRequest): Promise<void> {
    this.validateOperationId(operationId);
    if (!Number.isSafeInteger(nextAttemptAtEpochMilliseconds) || nextAttemptAtEpochMilliseconds < 0) {
      throw this.createInvalidOutboxQueryError('nextAttemptAtEpochMilliseconds', nextAttemptAtEpochMilliseconds);
    }
    const entry = this.pendingChanges.get(operationId);
    if (!entry) {
      throw new ProjectRepositoryError({
        code: ProjectRepositoryErrorCode.OUTBOX_ENTRY_NOT_FOUND,
        message: `재시도할 프로젝트 변경을 찾을 수 없습니다: ${operationId}`,
        details: { operationId },
      });
    }
    this.pendingChanges.set(operationId, {
      ...entry,
      attemptCount: entry.attemptCount + 1,
      nextAttemptAtEpochMilliseconds,
    });
  }

  async load(projectId: string): Promise<ProjectDocumentSnapshot | null> {
    const storedProject = this.projects.get(projectId);
    return storedProject ? cloneAndValidateProjectDocument(storedProject.document) : null;
  }

  async list(): Promise<readonly ProjectSummary[]> {
    return [...this.projects.values()].map(({ document, savedAtEpochMilliseconds }) => ({
      projectId: document.project.id,
      name: document.project.name,
      revision: document.project.revision,
      savedAtEpochMilliseconds,
    }));
  }

  async delete({ projectId, expectedRevision }: DeleteProjectRequest): Promise<void> {
    validateExpectedRevision(expectedRevision);
    const storedProject = this.getStoredProject(projectId);
    const storedRevision = storedProject.document.project.revision;

    if (storedRevision !== expectedRevision) {
      throw new ProjectRepositoryError({
        code: ProjectRepositoryErrorCode.REVISION_CONFLICT,
        message: `프로젝트 revision이 변경되었습니다: ${projectId}`,
        details: { projectId, expectedRevision, storedRevision },
      });
    }

    this.projects.delete(projectId);
    for (const [operationId, entry] of this.pendingChanges) {
      if (entry.projectId === projectId) {
        this.pendingChanges.delete(operationId);
      }
    }
  }

  private cloneOutboxEntry(entry: ProjectOutboxEntry): ProjectOutboxEntry {
    return { ...entry, document: cloneAndValidateProjectDocument(entry.document) };
  }

  private validateOperationId(operationId: string): void {
    const result = z.uuid().safeParse(operationId);
    if (!result.success) {
      throw new ProjectRepositoryError({
        code: ProjectRepositoryErrorCode.INVALID_OPERATION_ID,
        message: `프로젝트 변경 operation ID가 유효하지 않습니다: ${operationId}`,
        details: { operationId },
        cause: result.error,
      });
    }
  }

  private createInvalidOutboxQueryError(field: string, value: unknown): ProjectRepositoryError {
    return new ProjectRepositoryError({
      code: ProjectRepositoryErrorCode.INVALID_OUTBOX_QUERY,
      message: `Outbox 조회 값이 유효하지 않습니다: ${field}`,
      details: { field, value },
    });
  }

  private getStoredProject(projectId: string): StoredProject {
    const storedProject = this.projects.get(projectId);
    if (storedProject) {
      return storedProject;
    }

    throw new ProjectRepositoryError({
      code: ProjectRepositoryErrorCode.PROJECT_NOT_FOUND,
      message: `프로젝트를 찾을 수 없습니다: ${projectId}`,
      details: { projectId },
    });
  }
}
