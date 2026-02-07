import type { TrackData } from '@/AudioEngine/track/Track';

/**
 * Export 범위
 */
export interface ExportRange {
    startTime: number;
    endTime: number;
}

/**
 * Export 옵션
 */
export interface ExportOptions {
    /** 내보낼 트랙 목록 (지정하지 않으면 모든 트랙) */
    tracks?: TrackData[];
    /** 내보내기 범위 (지정하지 않으면 전체) */
    range?: ExportRange;
}
