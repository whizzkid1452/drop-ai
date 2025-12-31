import type { AudioFile } from './audioFile';

export const RegionStatus = {
  active: 'active',
  inactive: 'inactive',
} as const;
export type RegionStatus = (typeof RegionStatus)[keyof typeof RegionStatus];

export interface Region {
  id: string;
  startTime: number;
  endTime: number;
  audioFile: AudioFile;
  /** @note 추후 중첩 상태가 발생할 수 있기 때문에 배열로 관리 */
  status: Array<RegionStatus>;
}

export const TrackStatus = {
  mute: 'mute',
  solo: 'solo',
  normal: 'normal',
} as const;
export type TrackStatus = (typeof TrackStatus)[keyof typeof TrackStatus];

export interface Track {
  id: string;
  name?: string; // 트랙 이름 (optional)
  regions: Array<Region>;
  /** @note 추후 중첩 상태가 발생할 수 있기 때문에 배열로 관리 */
  status: Array<TrackStatus>;
  volume: number;
  pan: number;
}
