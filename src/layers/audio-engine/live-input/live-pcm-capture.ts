export interface CapturedPcm {
  readonly channels: readonly Float32Array[];
  readonly sampleRate: number;
}

export interface SchedulePcmCaptureRequest {
  readonly audioContext: AudioContext;
  readonly durationSeconds: number;
  readonly onStarted: () => void;
  readonly startTimeSeconds: number;
  readonly stream: MediaStream;
}

export interface ScheduledPcmCapture {
  readonly completion: Promise<CapturedPcm>;
  cancel(): void;
}

export interface ILivePcmCapture {
  schedule(request: SchedulePcmCaptureRequest): Promise<ScheduledPcmCapture>;
}
