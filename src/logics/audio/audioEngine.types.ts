import type { Track } from '@/types/track';
import type { AudioCommand, AudioCommandType } from '@/types/audioCommand.schema';

/**
 * AudioEngine이 외부에서 필요로 하는 의존성 인터페이스
 * 
 * 목적:
 * - Store 구현에 직접 의존하지 않음
 * - 테스트 시 Mock/Stub으로 쉽게 대체 가능
 * - 명확한 의존성 표현
 */
export interface AudioEngineDependencies {
  /** 현재 프로젝트의 모든 트랙 가져오기 */
  getTracks: () => Track[];
  
  /** 내보내기 범위 가져오기 (없으면 null) */
  getExportRange: () => { startTime: number; endTime: number } | null;
  
  /** 트랙 상태 업데이트 (UI 동기화용) */
  updateTrack: (trackId: string, update: Partial<Track>) => void;
  
  /** 재생 상태 업데이트 (UI 동기화용) */
  updatePlaybackState: (state: {
    isPlaying?: boolean;
    currentTime?: number;
  }) => void;

  /** Export 범위 설정 (UI 동기화용) */
  setExportRange: (startTime: number | null, endTime: number | null) => void;
}

/**
 * 각 Command 타입별 반환 타입 정의
 * - 타입 안정성 확보
 * - any 타입 제거
 */
export type CommandResult = {
  [AudioCommandType.PLAY]: boolean;
  [AudioCommandType.PAUSE]: boolean;
  [AudioCommandType.STOP]: boolean;
  [AudioCommandType.SET_TRACK_VOLUME]: boolean;
  [AudioCommandType.SET_TRACK_PAN]: boolean;
  [AudioCommandType.LOAD_REGION]: boolean;
  [AudioCommandType.UNLOAD_REGION]: boolean;
  [AudioCommandType.GET_TRACK_INFO]: [string, Track][];
  [AudioCommandType.SET_CURRENT_TIME]: number;
  [AudioCommandType.SET_EXPORT_RANGE]: { startTime: number; endTime: number };
  [AudioCommandType.CLEAR_EXPORT_RANGE]: boolean;
  [AudioCommandType.EXPORT_AUDIO]: Blob;
};

/**
 * Command 타입에 따른 반환 타입 추론
 */
export type ExecuteResult<T extends AudioCommand> = 
  T extends { type: infer Type extends keyof CommandResult }
    ? CommandResult[Type]
    : never;

/**
 * Track 내부 데이터 구조
 */
export interface TrackData {
  channel: any; // Tone.Channel (Tone.js 타입)
  players: Map<string, any>; // Map<regionId, Tone.Player>
}
