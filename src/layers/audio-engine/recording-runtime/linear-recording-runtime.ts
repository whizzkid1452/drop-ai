import type { TrackRecordingInput } from '../../shared/types/linear-recording';

export interface LinearRecordingCapture {
  readonly blob: Blob;
  readonly durationSeconds: number;
  readonly sampleRate: number;
}

export type LinearRecordingTrackResult =
  | { readonly capture: LinearRecordingCapture; readonly status: 'success'; readonly trackId: string }
  | { readonly cause: unknown; readonly status: 'failure'; readonly trackId: string };

export interface StartLinearRecordingRuntimeRequest {
  readonly assignments: readonly TrackRecordingInput[];
  readonly onStarted: () => void;
  readonly startDelaySeconds: number;
}

export interface ILinearRecordingAudioRuntime {
  cancelRecording(): void;
  startRecording(request: StartLinearRecordingRuntimeRequest): Promise<void>;
  stopRecording(): Promise<readonly LinearRecordingTrackResult[]>;
}
