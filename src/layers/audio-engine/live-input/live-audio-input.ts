export interface OpenLiveAudioInputOptions {
  readonly deviceId?: string;
}

export interface ILiveAudioInputConnection {
  readonly deviceId: string | null;
  readonly stream: MediaStream;
  close(): void;
}

export interface ILiveAudioInput {
  listDevices(): Promise<readonly LiveAudioInputDevice[]>;
  open(options: OpenLiveAudioInputOptions): Promise<ILiveAudioInputConnection>;
}
import type { LiveAudioInputDevice } from '../../shared/types/live-input';
