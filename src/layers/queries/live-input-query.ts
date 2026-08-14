import type { LiveAudioInputDevice, LiveInputRuntimeState } from '../shared/types/live-input';

export interface ILiveInputQuerySource {
  getLiveInputState(): LiveInputRuntimeState;
  listLiveInputDevices(): Promise<readonly LiveAudioInputDevice[]>;
  subscribeLiveInputState(listener: () => void): () => void;
}

export interface ILiveInputQuery {
  listDevices(): Promise<readonly LiveAudioInputDevice[]>;
  readState(): LiveInputRuntimeState;
  subscribe(listener: () => void): () => void;
}

export class LiveInputQuery implements ILiveInputQuery {
  private cachedState: LiveInputRuntimeState | null = null;

  constructor(private readonly source: ILiveInputQuerySource) {}

  async listDevices(): Promise<readonly LiveAudioInputDevice[]> {
    const devices = await this.source.listLiveInputDevices();
    return devices.map(device => ({ ...device }));
  }

  readState(): LiveInputRuntimeState {
    const nextState = this.source.getLiveInputState();
    if (
      this.cachedState?.deviceId === nextState.deviceId &&
      this.cachedState.monitoringTrackId === nextState.monitoringTrackId
    ) {
      return this.cachedState;
    }

    this.cachedState = { ...nextState };
    return this.cachedState;
  }

  subscribe(listener: () => void): () => void {
    return this.source.subscribeLiveInputState(listener);
  }
}
