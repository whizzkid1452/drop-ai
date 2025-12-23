import type { AudioFile } from "./audioFile";

export interface Region {
  startTime: number;
  endTime: number;
  audioFile: AudioFile;
  /** @note 추후 중첩 상태가 발생할 수 있기 때문에 배열로 관리 */
  status: Array<'active' | 'inactive'>
}

export interface Track {
  id: string;
  regions: Array<Region>;
  /** @note 추후 중첩 상태가 발생할 수 있기 때문에 배열로 관리 */
  status: Array<'mute' | 'solo' | 'normal'>;
  volume: number;
  pan: number;
}