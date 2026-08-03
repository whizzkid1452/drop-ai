import type { TrackState } from '@/layers/session/session';

export function getMaxDuration(tracks: readonly TrackState[]): number {
  let maxDuration = 0;

  tracks.forEach(track => {
    track.regions.forEach(region => {
      maxDuration = Math.max(maxDuration, region.startTime + region.duration);
    });
  });

  return maxDuration;
}
