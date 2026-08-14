export interface LiveAudioInputDevice {
  readonly deviceId: string;
  readonly label: string;
}

export interface LiveInputRuntimeState {
  readonly deviceId: string | null;
  readonly monitoringTrackId: string | null;
}

export type LiveInputRuntimeListener = (state: LiveInputRuntimeState) => void;
