import { PROJECT_DOCUMENT_SCHEMA_VERSION_V19, type ProjectMetadata } from '../shared/types/project-document.schema';
import type { ISessionRecoveryStore, SessionRecoveryCheckpoint } from '../shared/types/session-recovery';
export type {
  ISessionRecoveryQuery,
  ISessionRecoveryStore,
  SessionRecoveryCheckpoint,
} from '../shared/types/session-recovery';

const STORAGE_KEY = 'drop-ai:session-recovery:v1';

export class BrowserSessionRecoveryStore implements ISessionRecoveryStore {
  private readonly listeners = new Set<() => void>();
  private snapshot: SessionRecoveryCheckpoint | null;

  constructor(
    private readonly storage?: Storage,
    private readonly now: () => number = () => Date.now()
  ) {
    this.snapshot = this.readStorage();
  }

  readonly getSnapshot = (): SessionRecoveryCheckpoint | null => this.snapshot;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  record(project: ProjectMetadata): void {
    this.snapshot = {
      projectId: project.id,
      projectName: project.name,
      projectRevision: project.revision,
      savedAtEpochMilliseconds: this.now(),
      schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V19,
    };
    this.writeStorage();
    this.publish();
  }

  dismiss(projectId?: string): void {
    if (projectId && this.snapshot?.projectId !== projectId) {
      return;
    }
    this.snapshot = null;
    this.storage?.removeItem(STORAGE_KEY);
    this.publish();
  }

  private readStorage(): SessionRecoveryCheckpoint | null {
    if (!this.storage) {
      return null;
    }
    try {
      const candidate = JSON.parse(
        this.storage.getItem(STORAGE_KEY) ?? 'null'
      ) as Partial<SessionRecoveryCheckpoint> | null;
      if (
        !candidate ||
        candidate.schemaVersion !== PROJECT_DOCUMENT_SCHEMA_VERSION_V19 ||
        typeof candidate.projectId !== 'string' ||
        typeof candidate.projectRevision !== 'number'
      ) {
        this.storage.removeItem(STORAGE_KEY);
        return null;
      }
      return candidate as SessionRecoveryCheckpoint;
    } catch {
      this.storage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  private writeStorage(): void {
    if (!this.storage || !this.snapshot) {
      return;
    }
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.snapshot));
    } catch {
      this.storage.removeItem(STORAGE_KEY);
    }
  }

  private publish(): void {
    this.listeners.forEach(listener => listener());
  }
}
