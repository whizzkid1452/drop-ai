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
  /** 기존 JSON Outbox record에는 없으며 새 commit부터 CRDT update를 저장한다. */
  readonly crdtUpdateBase64?: string;
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

export interface RemoteProjectCrdtUpdate {
  readonly operationId: string;
  readonly sequenceId: number;
  readonly updateBase64: string;
}

export interface ApplyRemoteProjectUpdatesRequest {
  readonly projectId: string;
  readonly updates: readonly RemoteProjectCrdtUpdate[];
}

export interface AppliedRemoteProjectUpdates {
  readonly appliedUpdateCount: number;
  readonly document: ProjectDocumentSnapshot | null;
  readonly lastSequenceId: number;
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
  applyRemoteProjectUpdates(request: ApplyRemoteProjectUpdatesRequest): Promise<AppliedRemoteProjectUpdates>;
  getLastAppliedRemoteSequenceId(projectId: string): Promise<number>;
  listPendingChanges(request: ListPendingProjectChangesRequest): Promise<readonly ProjectOutboxEntry[]>;
  acknowledgePendingChange(operationId: string): Promise<void>;
  schedulePendingChangeRetry(request: ScheduleProjectChangeRetryRequest): Promise<void>;
}
