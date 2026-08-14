export interface AudioMonitorState {
  readonly isCut: boolean;
  readonly isDimmed: boolean;
  readonly isMono: boolean;
}

export type AudioMonitorStateListener = (state: AudioMonitorState) => void;

export const DEFAULT_AUDIO_MONITOR_STATE: AudioMonitorState = {
  isCut: false,
  isDimmed: false,
  isMono: false,
};

export const AUDIO_MONITOR_DIM_GAIN = 0.1;

export function cloneAudioMonitorState(state: AudioMonitorState): AudioMonitorState {
  return { ...state };
}
