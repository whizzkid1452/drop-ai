import { PROJECT_DOCUMENT_SCHEMA_VERSION_V18, type ProjectMetadata } from './project-document.schema';

export interface SessionRecoveryCheckpoint {
  readonly projectId: string;
  readonly projectName: string;
  readonly projectRevision: number;
  readonly savedAtEpochMilliseconds: number;
  readonly schemaVersion: typeof PROJECT_DOCUMENT_SCHEMA_VERSION_V18;
}

export interface ISessionRecoveryQuery {
  readonly getSnapshot: () => SessionRecoveryCheckpoint | null;
  readonly subscribe: (listener: () => void) => () => void;
}

export interface ISessionRecoveryStore extends ISessionRecoveryQuery {
  dismiss(projectId?: string): void;
  record(project: ProjectMetadata): void;
}
