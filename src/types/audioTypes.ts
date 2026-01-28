import type { TrackData } from '@/core/track/Track';


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
