import type { LiveAudioInputDevice, LiveInputRuntimeState } from '../shared/types/live-input';

export interface ILiveInputQuerySource {
  getLiveInputState(): LiveInputRuntimeState;
  listLiveInputDevices(): Promise<readonly LiveAudioInputDevice[]>;
}

export interface ILiveInputQuery {
  listDevices(): Promise<readonly LiveAudioInputDevice[]>;
  readState(): LiveInputRuntimeState;
}

export class LiveInputQuery implements ILiveInputQuery {
  constructor(private readonly source: ILiveInputQuerySource) {}

  async listDevices(): Promise<readonly LiveAudioInputDevice[]> {
    const devices = await this.source.listLiveInputDevices();
    return devices.map(device => ({ ...device }));
  }

  readState(): LiveInputRuntimeState {
    return { ...this.source.getLiveInputState() };
  }
}
