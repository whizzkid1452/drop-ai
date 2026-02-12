import type { TrackStatus } from '@/types/statusTypes';
import type { RegionState } from '@/layers/session';

export interface TrackData {
    id: string;
    name: string;
    volume: number;
    pan: number;
    status: TrackStatus[];
    regions: RegionState[];
}


/**
 * Interface representing the immutable snapshot of the Audio Engine state.
 * Consumed by UI components for rendering.
 */
export interface AudioSnapshot {
    // Playback State
    isPlaying: boolean;
    currentTime: number;
    
    // Configuration State
    tempo: number;
    exportStartTime: number | null;
    exportEndTime: number | null;

    // Track State
    tracks: TrackData[];
}
