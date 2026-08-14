export interface LinearRecordingCapture {
  readonly blob: Blob;
  readonly durationSeconds: number;
  readonly sampleRate: number;
}

export interface StartLinearRecordingRuntimeRequest {
  readonly onStarted: () => void;
  readonly startDelaySeconds: number;
}

export interface ILinearRecordingAudioRuntime {
  cancelRecording(): void;
  startRecording(request: StartLinearRecordingRuntimeRequest): Promise<void>;
  stopRecording(): Promise<LinearRecordingCapture>;
}
