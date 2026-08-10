import type { ProjectOutboxEntry } from '../project-repository/i-project-repository';

export interface ProjectSyncSuccess {
  readonly operationId: string;
  readonly serverRevision: number;
  readonly status: 'already_applied' | 'applied';
}

export interface IProjectSyncGateway {
  pushProjectChange(change: ProjectOutboxEntry): Promise<ProjectSyncSuccess>;
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
