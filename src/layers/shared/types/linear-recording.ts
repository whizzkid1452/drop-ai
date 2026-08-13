export type LinearRecordingPhase = 'idle' | 'scheduled' | 'recording' | 'stopping';

export interface TrackRecordingInput {
  readonly channelIndex: number;
  readonly deviceId: string | null;
  readonly trackId: string;
}

export interface RecordingRuntimeState {
  readonly armedTrackIds: readonly string[];
  readonly inputRoutes: readonly TrackRecordingInput[];
  readonly phase: LinearRecordingPhase;
  readonly recordStartTimeSeconds: number | null;
}

export interface SetTrackRecordArmRequest {
  readonly armed: boolean;
  readonly trackId: string;
}

export type SetTrackRecordingInputRequest = TrackRecordingInput;

export interface StartLinearRecordingRequest {
  readonly recordStartTimeSeconds: number;
  readonly startDelaySeconds: number;
}

export interface RecordedTake {
  readonly blob: Blob;
  readonly durationSeconds: number;
  readonly sampleRate: number;
  readonly startedAtSeconds: number;
  readonly trackId: string;
}

export interface RecordingTrackFailure {
  readonly cause: unknown;
  readonly stage: 'capture' | 'persist';
  readonly trackId: string;
}

export interface MultiTrackRecordingResult {
  readonly failures: readonly RecordingTrackFailure[];
  readonly takes: readonly RecordedTake[];
}

export type RecordingRuntimeListener = (state: RecordingRuntimeState) => void;
