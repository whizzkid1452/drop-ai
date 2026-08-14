import type { MeterFrame } from '../../shared/types/meter-frame';
import type { PcmCaptureWorkletRuntime } from '../live-input/live-pcm-capture';

export interface CreateLoopAudioBufferRequest {
  readonly channels: readonly Float32Array[];
  readonly sampleRate: number;
}

export interface CreateLoopPlayerRequest {
  readonly audioBuffer: AudioBuffer;
  readonly destination: AudioNode;
  readonly gain: number;
  readonly sourceEndTimeSeconds: number | null;
  readonly sourceStartTimeSeconds: number;
}

export interface SetLoopMonitoringRequest {
  readonly destination: AudioNode | null;
  readonly stream: MediaStream;
}

export interface ILoopPlayer {
  dispose(): void;
  configure(request: Omit<CreateLoopPlayerRequest, 'audioBuffer' | 'destination'>): void;
  startAt(contextTimeSeconds: number): void;
  stopAt(contextTimeSeconds: number): void;
}

export interface ILoopPlaybackAdapter extends PcmCaptureWorkletRuntime {
  createAudioBuffer(request: CreateLoopAudioBufferRequest): AudioBuffer;
  createPlayer(request: CreateLoopPlayerRequest): ILoopPlayer;
  getAudioContext(): AudioContext;
  getContextTimeSeconds(): number;
  getTransportTimeSeconds(): number;
  prepare(): Promise<void>;
  readInputMeterFrame(): MeterFrame;
  setMonitoring(request: SetLoopMonitoringRequest): void;
}
