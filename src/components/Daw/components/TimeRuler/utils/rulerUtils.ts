import type { Track } from '@/types/track';

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function getMaxDuration(tracks: Track[]) {
  let max = 0;
  tracks.forEach(track => {
    track.regions.forEach(region => {
      const duration = region.audioFile?.duration ?? region.duration ?? 0;
      const endTime = region.startTime + duration;
      if (endTime > max) max = endTime;
    });
  });
  return max;
}
