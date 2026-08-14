export type LinearRecordingPhase = 'idle' | 'scheduled' | 'recording' | 'stopping';

export interface RecordingRuntimeState {
  readonly armedTrackId: string | null;
  readonly phase: LinearRecordingPhase;
  readonly recordStartTimeSeconds: number | null;
}

export interface SetTrackRecordArmRequest {
  readonly armed: boolean;
  readonly trackId: string;
}

export interface StartLinearRecordingRequest {
  readonly recordStartTimeSeconds: number;
  readonly startDelaySeconds: number;
  readonly trackId: string;
}

export interface RecordedTake {
  readonly blob: Blob;
  readonly durationSeconds: number;
  readonly sampleRate: number;
  readonly startedAtSeconds: number;
  readonly trackId: string;
}

export type RecordingRuntimeListener = (state: RecordingRuntimeState) => void;
