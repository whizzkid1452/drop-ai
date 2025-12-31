import type { Track } from '@/types/track';

/**
 * Shadow State: Lightweight metadata for AI context
 * 
 * Purpose:
 * - Reduce token usage (don't send full audio buffers/blobs to AI)
 * - Provide structured context for AI decision-making
 * - Enable complex commands (e.g., "increase volume on track 2")
 * 
 * Design:
 * - Only essential metadata (no binary data)
 * - Human-readable format for better AI comprehension
 * - Extensible for future features (effects, automation)
 * 
 * @see docs/refactor-plan.md - "컨텍스트 윈도우 관리 (State Summarization)"
 */

export interface TrackShadow {
  id: string;
  name: string;
  volume: number; // 0.0 to 1.0
  pan: number; // -1.0 to 1.0
  regionCount: number;
  duration: number; // seconds
  effects: string[]; // Future: ["reverb", "delay"]
}

export interface ShadowState {
  tracks: TrackShadow[];
  projectDuration: number; // seconds (longest track)
  currentTime: number; // seconds (playhead position)
  isPlaying: boolean;
  tempo: number; // BPM
}

/**
 * Create a Shadow State from current project state
 * 
 * @param tracks - All tracks from useTrackStore
 * @param currentTime - Current playback position
 * @param isPlaying - Playback status
 * @param tempo - Project tempo (BPM)
 * @returns Lightweight metadata object for AI
 */
export function createShadowState(
  tracks: Track[],
  currentTime: number,
  isPlaying: boolean,
  tempo: number
): ShadowState {
  const trackShadows: TrackShadow[] = tracks.map((track, index) => ({
    id: track.id,
    name: track.name || `Track ${index + 1}`,
    volume: track.volume ?? 1.0,
    pan: track.pan ?? 0.0,
    regionCount: track.regions.length,
    duration: track.regions[0]?.audioFile.duration ?? 0,
    effects: [], // Future implementation
  }));

  const projectDuration = Math.max(
    ...trackShadows.map(t => t.duration),
    0 // Fallback if no tracks
  );

  return {
    tracks: trackShadows,
    projectDuration,
    currentTime,
    isPlaying,
    tempo,
  };
}

/**
 * Format Shadow State as human-readable text for AI prompts
 * 
 * Example output:
 * ```
 * Project Status:
 * - Playing: Yes
 * - Current Time: 12.5s / 60.0s
 * - Tempo: 120 BPM
 * 
 * Tracks (3):
 * 1. Track 1 (ID: abc-123)
 *    - Volume: 80%, Pan: Center
 *    - Duration: 45.2s, Regions: 1
 * 2. Track 2 (ID: def-456)
 *    - Volume: 60%, Pan: Left (-0.5)
 *    - Duration: 60.0s, Regions: 2
 * ```
 */
export function formatShadowStateForAI(shadowState: ShadowState): string {
  const { tracks, projectDuration, currentTime, isPlaying, tempo } = shadowState;

  const statusSection = `Project Status:
- Playing: ${isPlaying ? 'Yes' : 'No'}
- Current Time: ${currentTime.toFixed(1)}s / ${projectDuration.toFixed(1)}s
- Tempo: ${tempo} BPM`;

  const tracksSection = `Tracks (${tracks.length}):
${tracks.map((track, index) => {
  const volumePercent = Math.round(track.volume * 100);
  const panLabel = 
    track.pan === 0 ? 'Center' :
    track.pan < 0 ? `Left (${track.pan.toFixed(2)})` :
    `Right (${track.pan.toFixed(2)})`;

  return `${index + 1}. ${track.name} (ID: ${track.id})
   - Volume: ${volumePercent}%, Pan: ${panLabel}
   - Duration: ${track.duration.toFixed(1)}s, Regions: ${track.regionCount}`;
}).join('\n')}`;

  return `${statusSection}\n\n${tracksSection}`;
}

