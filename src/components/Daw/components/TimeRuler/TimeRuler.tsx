import { memo, useMemo } from 'react';
import { useTrackStore } from '@/stores/useTrackStore';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import * as styles from './TimeRuler.css';
import type { Track } from '@/types/track';
import { useAudioEngineHandleWithUi } from '@/hooks/agent/useAudioEngineHandleWithUi';
import { AudioCommandType } from '@/types/audioCommand.schema';
export const TimeRuler = memo(() => {
  const tracks = useTrackStore(state => state.tracks);
  const pixelsPerSecond = usePlaybackStore(state => state.pixelsPerSecond);

  const maxDuration = useMemo(() => getMaxDuration(tracks), [tracks]);

  const ticks = useMemo(() => {
    const tickElements = [];
    const step = 1; // 1 second steps

    for (let i = 0; i <= maxDuration; i += step) {
      const isMajor = i % Math.max(1, Math.floor(60 / pixelsPerSecond)) === 0;

      tickElements.push(
        <div
          key={i}
          className={`${styles.tick} ${isMajor ? styles.majorTick : ''}`}
          style={{ left: `${i * pixelsPerSecond}px` }}
        >
          {isMajor && <span className={styles.label}>{formatTime(i)}</span>}
        </div>
      );
    }
    return tickElements;
  }, [maxDuration, pixelsPerSecond]);

  const { handleAudioCommand } = useAudioEngineHandleWithUi();

  const handleTimeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    /** @warning it depends on PIXELS_PER_SECOND */
    const time = Math.max(0, x / pixelsPerSecond);

    handleAudioCommand({
      type: AudioCommandType.SET_CURRENT_TIME,
      time,
    });
  };

  return (
    <div className={styles.container} onClick={handleTimeClick}>
      {ticks}
    </div>
  );
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
