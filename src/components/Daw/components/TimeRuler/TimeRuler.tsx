import { memo, useMemo } from 'react';
import { useTrackStore } from '@/stores/useTrackStore';
import { PIXELS_PER_SECOND } from '@/constants/dawConstants';
import * as styles from './TimeRuler.css';
import type { Track } from '@/types/track';

export const TimeRuler = memo(() => {
  const tracks = useTrackStore(state => state.tracks);

  const maxDuration = useMemo(() => getMaxDuration(tracks), [tracks]);

  const ticks = useMemo(() => {
    const tickElements = [];
    const step = 1; // 1 second steps

    for (let i = 0; i <= maxDuration; i += step) {
      const isMajor = i % (60 / PIXELS_PER_SECOND) === 0;

      tickElements.push(
        <div
          key={i}
          className={`${styles.tick} ${isMajor ? styles.majorTick : ''}`}
          style={{ left: `${i * PIXELS_PER_SECOND}px` }}
        >
          {isMajor && <span className={styles.label}>{formatTime(i)}</span>}
        </div>
      );
    }
    return tickElements;
  }, [maxDuration]);

  return <div className={styles.container}>{ticks}</div>;
});

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getMaxDuration(tracks: Map<string, Track>) {
  let max = 0;
  tracks.forEach(track => {
    track.regions.forEach(region => {
      const duration = region.audioFile.duration ?? 0;
      const endTime = region.startTime + duration;
      if (endTime > max) max = endTime;
    });
  });
  return max;
}
