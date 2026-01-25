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
    pixelsPerSecond: number;
    exportStartTime: number | null;
    exportEndTime: number | null;

    // Track State
    tracks: Array<{
        id: string;
        name: string;
        volume: number;
        pan: number;
        isMuted: boolean;
        isSoloed: boolean;
        status: any[];
        regions: Array<{
            id: string;
            startTime: number;
            endTime: number;
            sourceStartTime: number;
            duration: number;
            audioFile: any;
            status: any[];
        }>;
    }>;
}
