export interface CreateLoopAudioBufferRequest {
  readonly channels: readonly Float32Array[];
  readonly sampleRate: number;
}

export interface CreateLoopPlayerRequest {
  readonly audioBuffer: AudioBuffer;
  readonly destination: AudioNode;
}

export interface SetLoopMonitoringRequest {
  readonly destination: AudioNode | null;
  readonly stream: MediaStream;
}

export interface ILoopPlayer {
  dispose(): void;
  startAt(contextTimeSeconds: number): void;
  stopAt(contextTimeSeconds: number): void;
}

export interface ILoopPlaybackAdapter {
  createAudioBuffer(request: CreateLoopAudioBufferRequest): AudioBuffer;
  createPlayer(request: CreateLoopPlayerRequest): ILoopPlayer;
  getAudioContext(): AudioContext;
  getContextTimeSeconds(): number;
  getTransportTimeSeconds(): number;
  prepare(): Promise<void>;
  setMonitoring(request: SetLoopMonitoringRequest): void;
}
