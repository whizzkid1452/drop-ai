import type { RecordingRuntimeListener, RecordingRuntimeState } from '../shared/types/linear-recording';

export interface IRecordingQuerySource {
  getRecordingState(): RecordingRuntimeState;
  subscribeRecordingState(listener: RecordingRuntimeListener): () => void;
}

export interface IRecordingQuery {
  readState(): RecordingRuntimeState;
  subscribe(listener: () => void): () => void;
}

export class RecordingQuery implements IRecordingQuery {
  private cachedState: RecordingRuntimeState | null = null;

  constructor(private readonly source: IRecordingQuerySource) {}

  readState(): RecordingRuntimeState {
    const nextState = this.source.getRecordingState();
    if (
      this.cachedState?.armedTrackId === nextState.armedTrackId &&
      this.cachedState.phase === nextState.phase &&
      this.cachedState.recordStartTimeSeconds === nextState.recordStartTimeSeconds
    ) {
      return this.cachedState;
    }

    this.cachedState = { ...nextState };
    return this.cachedState;
  }

  subscribe(listener: () => void): () => void {
    return this.source.subscribeRecordingState(listener);
  }
}
