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

export interface IProjectSyncGateway {
  pullProjectUpdates(request: PullProjectUpdatesRequest): Promise<readonly RemoteProjectCrdtUpdate[]>;
  pushProjectChange(change: ProjectOutboxEntry): Promise<ProjectSyncSuccess>;
}

export interface IProjectMediaSync {
  ensureProjectMedia(document: ProjectDocumentSnapshot): Promise<void>;
}

export interface IProjectSyncService {
  activateProject(projectId: string): void;
  notifyProjectChanged(projectId: string): void;
  resume(): void;
}

export class NoopProjectSyncService implements IProjectSyncService {
  activateProject(): void {
    return undefined;
  }

  notifyProjectChanged(): void {
    return undefined;
  }

  resume(): void {
    return undefined;
  }
}

export class NoopProjectMediaSync implements IProjectMediaSync {
  async ensureProjectMedia(): Promise<void> {
    return undefined;
  }
}
