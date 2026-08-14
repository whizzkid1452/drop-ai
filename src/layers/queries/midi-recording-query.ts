import type { MidiRecordingRuntimeListener, MidiRecordingRuntimeState } from '../shared/types/midi-recording';

export interface IMidiRecordingQuerySource {
  getRecordingState(): MidiRecordingRuntimeState;
  subscribeRecordingState(listener: MidiRecordingRuntimeListener): () => void;
}

export interface IMidiRecordingQuery {
  readState(): MidiRecordingRuntimeState;
  subscribe(listener: () => void): () => void;
}

export class MidiRecordingQuery implements IMidiRecordingQuery {
  private cachedState: MidiRecordingRuntimeState | null = null;

  constructor(private readonly source: IMidiRecordingQuerySource) {}

  readState(): MidiRecordingRuntimeState {
    const nextState = this.source.getRecordingState();
    if (
      this.cachedState !== null &&
      this.cachedState.capturedEventCount === nextState.capturedEventCount &&
      this.cachedState.inputChannel === nextState.inputChannel &&
      this.cachedState.inputId === nextState.inputId &&
      this.cachedState.isRecording === nextState.isRecording &&
      this.cachedState.trackId === nextState.trackId
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
