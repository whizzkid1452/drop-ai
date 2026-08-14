import type {
  ArmLoopRuntimeRequest,
  ILoopAudioRuntime,
  IPreparedLoopRuntimeReplacement,
  LoadLoopRuntimeRequest,
  LoopRuntimeListener,
  LoopSlotAddress,
  SetLiveInputMonitoringRuntimeRequest,
  StopAllLoopsRequest,
  TriggerLoopRequest,
} from './loop-runtime-contract';
import { COMPLETE_RESOURCE_CLEANUP } from '../../shared/types/resource-cleanup';
import type { MeterFrame } from '../../shared/types/meter-frame';
import type { LiveAudioInputDevice } from '../../shared/types/live-input';

const RUNTIME_UNAVAILABLE_MESSAGE = '이 AudioEngine에는 루프 오디오 런타임이 구성되지 않았습니다.';

function throwRuntimeUnavailable(): never {
  throw new Error(RUNTIME_UNAVAILABLE_MESSAGE);
}

export class UnavailableLoopAudioRuntime implements ILoopAudioRuntime {
  async arm(_request: ArmLoopRuntimeRequest): Promise<void> {
    void _request;
    throwRuntimeUnavailable();
  }

  async overdub(_request: ArmLoopRuntimeRequest): Promise<void> {
    void _request;
    throwRuntimeUnavailable();
  }

  cancel(_address: LoopSlotAddress): void {
    void _address;
  }

  clear(_address: LoopSlotAddress): void {
    void _address;
  }

  clearTrack(_trackId: string): void {
    void _trackId;
  }

  async load(_request: LoadLoopRuntimeRequest): Promise<void> {
    void _request;
    throwRuntimeUnavailable();
  }

  async listInputDevices(): Promise<readonly LiveAudioInputDevice[]> {
    return throwRuntimeUnavailable();
  }

  async prepareReplacement(requests: readonly LoadLoopRuntimeRequest[]): Promise<IPreparedLoopRuntimeReplacement> {
    if (requests.length > 0) {
      throwRuntimeUnavailable();
    }

    return {
      assertActivatable: () => undefined,
      activate: () => ({ dispose: () => COMPLETE_RESOURCE_CLEANUP }),
      discard: () => COMPLETE_RESOURCE_CLEANUP,
    };
  }

  readInputMeterFrame(): MeterFrame {
    return throwRuntimeUnavailable();
  }

  async setInputDevice(_deviceId: string | null): Promise<string | null> {
    void _deviceId;
    return throwRuntimeUnavailable();
  }

  async setMonitoring(_request: SetLiveInputMonitoringRuntimeRequest): Promise<void> {
    void _request;
    throwRuntimeUnavailable();
  }

  stop(_request: TriggerLoopRequest): void {
    void _request;
    throwRuntimeUnavailable();
  }

  stopAll(_request: StopAllLoopsRequest): void {
    void _request;
  }

  subscribe(_listener: LoopRuntimeListener): () => void {
    void _listener;
    return () => undefined;
  }

  async trigger(_request: TriggerLoopRequest): Promise<void> {
    void _request;
    throwRuntimeUnavailable();
  }
}
