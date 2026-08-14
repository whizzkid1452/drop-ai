import type { LoopLengthBars } from '../../shared/loop-time';
import type { ResourceCleanupResult } from '../../shared/types/resource-cleanup';
import type { LoopSlotRuntimeState } from '../../shared/types/loop-state';
import type { MeterFrame } from '../../shared/types/meter-frame';
import type { LiveAudioInputDevice } from '../../shared/types/live-input';

export type LoopRuntimeState = LoopSlotRuntimeState;
export type LoopCaptureMode = 'initial' | 'overdub';

export interface LoopSlotAddress {
  readonly slotId: string;
  readonly trackId: string;
}

export interface ArmLoopRequest extends LoopSlotAddress {
  readonly lengthBars: LoopLengthBars;
  readonly quantizationBars: LoopLengthBars;
  readonly tempoBpm: number;
}

export interface TriggerLoopRequest extends LoopSlotAddress {
  readonly quantizationBars: LoopLengthBars;
  readonly tempoBpm: number;
}

export interface StopAllLoopsRequest {
  readonly quantizationBars: LoopLengthBars;
  readonly tempoBpm: number;
}

export interface SetLiveInputMonitoringRequest {
  readonly enabled: boolean;
  readonly trackId: string;
}

export interface LoadLoopRequest extends LoopSlotAddress {
  readonly url: string;
}

export interface LoopRuntimeStateChangedEvent extends LoopSlotAddress {
  readonly scheduledTimeSeconds?: number;
  readonly state: LoopRuntimeState;
  readonly type: 'STATE_CHANGED';
}

export interface LoopRecordingCompletedEvent extends LoopSlotAddress {
  readonly blob: Blob;
  readonly captureMode: LoopCaptureMode;
  readonly durationSeconds: number;
  readonly recordedTempoBpm: number;
  readonly type: 'RECORDING_COMPLETED';
}

export interface LoopRuntimeErrorEvent extends LoopSlotAddress {
  readonly error: Error;
  readonly type: 'RUNTIME_ERROR';
}

export type LoopRuntimeEvent = LoopRuntimeErrorEvent | LoopRuntimeStateChangedEvent | LoopRecordingCompletedEvent;
export type LoopRuntimeListener = (event: LoopRuntimeEvent) => void;

export interface ArmLoopRuntimeRequest extends ArmLoopRequest {
  readonly destination: AudioNode;
}

export interface LoadLoopRuntimeRequest extends LoadLoopRequest {
  readonly destination: AudioNode;
}

export interface SetLiveInputMonitoringRuntimeRequest {
  readonly destination: AudioNode | null;
  readonly enabled: boolean;
}

export interface ILoopAudioRuntime {
  arm(request: ArmLoopRuntimeRequest): Promise<void>;
  overdub(request: ArmLoopRuntimeRequest): Promise<void>;
  cancel(address: LoopSlotAddress): void;
  clear(address: LoopSlotAddress): void;
  clearTrack(trackId: string): void;
  load(request: LoadLoopRuntimeRequest): Promise<void>;
  listInputDevices(): Promise<readonly LiveAudioInputDevice[]>;
  prepareReplacement(requests: readonly LoadLoopRuntimeRequest[]): Promise<IPreparedLoopRuntimeReplacement>;
  readInputMeterFrame(): MeterFrame;
  setInputDevice(deviceId: string | null): Promise<string | null>;
  setMonitoring(request: SetLiveInputMonitoringRuntimeRequest): Promise<void>;
  stop(request: TriggerLoopRequest): void;
  stopAll(request: StopAllLoopsRequest): void;
  subscribe(listener: LoopRuntimeListener): () => void;
  trigger(request: TriggerLoopRequest): Promise<void>;
}

export interface IRetiredLoopRuntime {
  dispose(): ResourceCleanupResult;
}

export interface IPreparedLoopRuntimeReplacement {
  assertActivatable(): void;
  activate(): IRetiredLoopRuntime;
  discard(): ResourceCleanupResult;
}
