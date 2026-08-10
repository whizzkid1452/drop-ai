import type { ProjectDocumentSnapshot } from '../shared/types/project-document.schema';

export interface ProjectSummary {
  readonly projectId: string;
  readonly name: string;
  readonly revision: number;
  readonly savedAtEpochMilliseconds: number;
}

export interface SaveProjectRequest {
  readonly document: ProjectDocumentSnapshot;
  readonly expectedRevision: number;
}

export interface DeleteProjectRequest {
  readonly projectId: string;
  readonly expectedRevision: number;
}

export interface CommitLocalProjectRequest {
  readonly document: ProjectDocumentSnapshot;
  readonly expectedRevision: number;
  readonly operationId: string;
}

export interface ProjectOutboxEntry {
  readonly operationId: string;
  readonly projectId: string;
  readonly baseRevision: number | null;
  readonly localRevision: number;
  readonly document: ProjectDocumentSnapshot;
  readonly createdAtEpochMilliseconds: number;
  readonly attemptCount: number;
  readonly nextAttemptAtEpochMilliseconds: number;
}

export interface ListPendingProjectChangesRequest {
  readonly projectId?: string;
  readonly dueAtEpochMilliseconds: number;
  readonly limit?: number;
}

export interface ScheduleProjectChangeRetryRequest {
  readonly operationId: string;
  readonly nextAttemptAtEpochMilliseconds: number;
}

export interface CommittedLocalProjectChange {
  readonly document: ProjectDocumentSnapshot;
  readonly outboxEntry: ProjectOutboxEntry;
}

export interface IProjectRepository {
  create(document: ProjectDocumentSnapshot): Promise<ProjectDocumentSnapshot>;
  save(request: SaveProjectRequest): Promise<ProjectDocumentSnapshot>;
  load(projectId: string): Promise<ProjectDocumentSnapshot | null>;
  list(): Promise<readonly ProjectSummary[]>;
  delete(request: DeleteProjectRequest): Promise<void>;
}

export interface ILocalFirstProjectRepository extends IProjectRepository {
  commitLocal(request: CommitLocalProjectRequest): Promise<CommittedLocalProjectChange>;
  listPendingChanges(request: ListPendingProjectChangesRequest): Promise<readonly ProjectOutboxEntry[]>;
  acknowledgePendingChange(operationId: string): Promise<void>;
  schedulePendingChangeRetry(request: ScheduleProjectChangeRetryRequest): Promise<void>;
}
