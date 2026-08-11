import type { ProjectOutboxEntry, RemoteProjectCrdtUpdate } from '../project-repository/i-project-repository';
import type { ProjectDocumentSnapshot } from '../shared/types/project-document.schema';

export type ProjectSyncSuccess =
  | {
      readonly kind: 'crdt-update';
      readonly operationId: string;
      readonly sequenceId: number;
      readonly status: 'already_applied' | 'applied';
    }
  | {
      readonly kind: 'snapshot';
      readonly operationId: string;
      readonly serverRevision: number;
      readonly status: 'already_applied' | 'applied';
    };

export interface PullProjectUpdatesRequest {
  readonly afterSequenceId: number;
  readonly limit: number;
  readonly projectId: string;
}

export interface RemoteProjectReference {
  readonly latestSequenceId: number;
  readonly projectId: string;
  readonly updatedAtEpochMilliseconds: number;
}

export interface IProjectSyncGateway {
  listRemoteProjects?(): Promise<readonly RemoteProjectReference[]>;
  pullProjectUpdates(request: PullProjectUpdatesRequest): Promise<readonly RemoteProjectCrdtUpdate[]>;
  pushProjectChange(change: ProjectOutboxEntry): Promise<ProjectSyncSuccess>;
}

export interface IProjectMediaSync {
  ensureLocalProjectMedia(document: ProjectDocumentSnapshot): Promise<void>;
  ensureProjectMedia(document: ProjectDocumentSnapshot): Promise<void>;
}

export interface IRemoteProjectDocumentApplicator {
  applyRemoteProjectDocument(document: ProjectDocumentSnapshot): Promise<boolean>;
}

export interface IProjectSyncService {
  activateProject(projectId: string): void;
  ensureLocalProject?(projectId: string): Promise<boolean>;
  ensureLocalProjectMedia(document: ProjectDocumentSnapshot): Promise<void>;
  listRemoteProjects?(): Promise<readonly RemoteProjectReference[]>;
  notifyProjectChanged(projectId: string): void;
  resume(): void;
}

export class NoopProjectSyncService implements IProjectSyncService {
  activateProject(): void {
    return undefined;
  }

  async ensureLocalProject(): Promise<boolean> {
    return false;
  }

  async ensureLocalProjectMedia(): Promise<void> {
    return undefined;
  }

  async listRemoteProjects(): Promise<readonly RemoteProjectReference[]> {
    return [];
  }

  notifyProjectChanged(): void {
    return undefined;
  }

  resume(): void {
    return undefined;
  }
}

export class NoopProjectMediaSync implements IProjectMediaSync {
  async ensureLocalProjectMedia(): Promise<void> {
    return undefined;
  }

  async ensureProjectMedia(): Promise<void> {
    return undefined;
  }
}

export class NoopRemoteProjectDocumentApplicator implements IRemoteProjectDocumentApplicator {
  async applyRemoteProjectDocument(): Promise<boolean> {
    return true;
  }
}
