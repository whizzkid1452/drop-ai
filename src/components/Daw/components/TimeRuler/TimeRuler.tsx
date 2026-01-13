import { memo, useMemo } from 'react';
import { useTrackStore } from '@/stores/useTrackStore';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import { useShallow } from 'zustand/react/shallow';
import * as styles from './TimeRuler.css';
import type { Track } from '@/types/track';
import { useAudioEngineHandleWithUi } from '@/hooks/agent/useAudioEngineHandleWithUi';
import { AudioCommandType } from '@/types/audioCommand.schema';
export const TimeRuler = memo(() => {
  const tracks = useTrackStore(state => state.tracks);
  const pixelsPerSecond = usePlaybackStore(state => state.pixelsPerSecond);
  const { exportStartTime, exportEndTime, setExportRange } = usePlaybackStore(
    useShallow(state => ({
      exportStartTime: state.exportStartTime,
      exportEndTime: state.exportEndTime,
      setExportRange: state.setExportRange,
    }))
  );

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

  /**
   * Export Range Interaction
   * Shift + Click/Drag to set export range
   */
  const handleRangeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!e.shiftKey) return;
    e.stopPropagation(); // Prevent time seek

    const rect = e.currentTarget.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startTime = Math.max(0, startX / pixelsPerSecond);

    setExportRange(startTime, startTime);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentX = moveEvent.clientX - rect.left;
      const currentTime = Math.max(0, currentX / pixelsPerSecond);

      // 항상 start < end가 되도록 정렬
      const newStart = Math.min(startTime, currentTime);
      const newEnd = Math.max(startTime, currentTime);
      
      setExportRange(newStart, newEnd);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Variable extraction for readability (Review Comment)
  const showExportRange =
    exportStartTime !== null &&
    exportEndTime !== null &&
    exportStartTime !== exportEndTime;

  return (
    <div
      className={styles.container}
      onClick={handleTimeClick}
      onMouseDown={handleRangeMouseDown}
    >
      {ticks}
      {showExportRange && (
        <div
          className={styles.exportRange}
          style={{
            left: `${exportStartTime! * pixelsPerSecond}px`,
            width: `${(exportEndTime! - exportStartTime!) * pixelsPerSecond}px`,
          }}
        />
      )}
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
