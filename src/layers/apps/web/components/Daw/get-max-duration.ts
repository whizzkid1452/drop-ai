import type { TrackState } from '@/layers/session/session';

export function getMaxDuration(tracks: readonly TrackState[]): number {
  let maxDuration = 0;

  tracks.forEach(track => {
    track.regions.forEach(region => {
      maxDuration = Math.max(maxDuration, region.startTime + region.duration);
    });
    track.midi?.regions.forEach(region => {
      maxDuration = Math.max(maxDuration, region.startTimeSeconds + region.durationSeconds);
    });
  });

  return maxDuration;
}
