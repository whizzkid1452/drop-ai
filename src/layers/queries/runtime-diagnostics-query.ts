import {
  classifyStorageHealth,
  type AudioEngineRuntimeHealth,
  type RuntimeDiagnosticsState,
  type RuntimeVisibilityState,
} from '../shared/types/runtime-diagnostics';

export interface StorageEstimate {
  readonly quota?: number;
  readonly usage?: number;
}

interface RuntimeDiagnosticsQueryOptions {
  readonly audioEngine: IRuntimeDiagnosticsQuerySource;
  readonly estimateStorage?: () => Promise<StorageEstimate>;
  readonly now?: () => string;
  readonly readVisibility?: () => string;
}

export interface IRuntimeDiagnosticsQuerySource {
  readonly getRuntimeHealth: () => AudioEngineRuntimeHealth;
}

export interface IRuntimeDiagnosticsQuery {
  readonly readState: () => RuntimeDiagnosticsState;
  readonly refresh: () => Promise<RuntimeDiagnosticsState>;
  readonly subscribe: (listener: () => void) => () => void;
}

function normalizeVisibilityState(state: string): RuntimeVisibilityState {
  if (state === 'hidden' || state === 'prerender' || state === 'visible') {
    return state;
  }
  return 'unknown';
}

function createBrowserStorageEstimate(): Promise<StorageEstimate> {
  return globalThis.navigator?.storage?.estimate?.() ?? Promise.resolve({});
}

function readBrowserVisibility(): string {
  return globalThis.document?.visibilityState ?? 'unknown';
}

export class RuntimeDiagnosticsQuery implements IRuntimeDiagnosticsQuery {
  readonly #audioEngine: IRuntimeDiagnosticsQuerySource;
  readonly #estimateStorage: () => Promise<StorageEstimate>;
  readonly #listeners = new Set<() => void>();
  readonly #now: () => string;
  readonly #readVisibility: () => string;
  #refreshRevision = 0;
  #state: RuntimeDiagnosticsState;

  constructor({
    audioEngine,
    estimateStorage = createBrowserStorageEstimate,
    now = () => new Date().toISOString(),
    readVisibility = readBrowserVisibility,
  }: RuntimeDiagnosticsQueryOptions) {
    this.#audioEngine = audioEngine;
    this.#estimateStorage = estimateStorage;
    this.#now = now;
    this.#readVisibility = readVisibility;
    this.#state = {
      ...audioEngine.getRuntimeHealth(),
      checkedAt: null,
      storage: classifyStorageHealth({}),
      visibilityState: normalizeVisibilityState(readVisibility()),
    };
  }

  readonly readState = (): RuntimeDiagnosticsState => this.#state;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  readonly refresh = async (): Promise<RuntimeDiagnosticsState> => {
    const refreshRevision = ++this.#refreshRevision;
    let storageEstimate: StorageEstimate = {};
    try {
      storageEstimate = await this.#estimateStorage();
    } catch {
      storageEstimate = {};
    }
    if (refreshRevision !== this.#refreshRevision) {
      return this.#state;
    }
    this.#state = {
      ...this.#audioEngine.getRuntimeHealth(),
      checkedAt: this.#now(),
      storage: classifyStorageHealth({ quotaBytes: storageEstimate.quota, usageBytes: storageEstimate.usage }),
      visibilityState: normalizeVisibilityState(this.#readVisibility()),
    };
    this.#listeners.forEach(listener => listener());
    return this.#state;
  };
}
