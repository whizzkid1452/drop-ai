export const AudioCommandType = {
  PLAY: 'PLAY',
  PAUSE: 'PAUSE',
  STOP: 'STOP',
  SET_TRACK_VOLUME: 'SET_TRACK_VOLUME',
  SET_TRACK_PAN: 'SET_TRACK_PAN',
  LOAD_REGION: 'LOAD_REGION',
  GET_TRACK_INFO: 'GET_TRACK_INFO',
} as const;
export type AudioCommandType =
  (typeof AudioCommandType)[keyof typeof AudioCommandType];

export type AudioCommand =
  | { type: typeof AudioCommandType.PLAY }
  | { type: typeof AudioCommandType.PAUSE }
  | { type: typeof AudioCommandType.STOP }
  | {
      type: typeof AudioCommandType.SET_TRACK_VOLUME;
      trackId: string;
      volume: number;
    }
  | {
      type: typeof AudioCommandType.SET_TRACK_PAN;
      trackId: string;
      pan: number;
    }
  | {
      type: typeof AudioCommandType.LOAD_REGION;
      trackId: string;
      regionId: string;
      url: string;
      startTime: number;
    }
  | {
      type: typeof AudioCommandType.GET_TRACK_INFO;
    };
