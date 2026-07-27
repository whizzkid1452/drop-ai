export interface OpenLiveAudioInputOptions {
  readonly deviceId?: string;
}

export interface ILiveAudioInputConnection {
  readonly deviceId: string | null;
  readonly stream: MediaStream;
  close(): void;
}

export interface ILiveAudioInput {
  open(options: OpenLiveAudioInputOptions): Promise<ILiveAudioInputConnection>;
}
