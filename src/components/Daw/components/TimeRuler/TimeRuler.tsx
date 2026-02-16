import { memo, useMemo, useRef, useState, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAudioService } from '@/presentation/hooks/useAudioService';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import * as styles from './TimeRuler.css';
import type { Track } from '@/types/track';
import { useAudioCommand } from '@/logics/audio';
import { AudioCommandType } from '@/types/audioCommand.schema';
import { useErrorBoundary } from 'react-error-boundary';

// ...

export const TimeRuler = memo(() => {
  const { tracks, exportStartTime, exportEndTime } = useAudioService(
    useShallow(state => ({
      tracks: state.tracks,
      exportStartTime: state.exportStartTime,
      exportEndTime: state.exportEndTime,
    }))
  );

  const pixelsPerSecond = usePlaybackStore(state => state.pixelsPerSecond);

  const trackArray = (tracks || []) as unknown as Track[];

  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragStartPosRef = useRef<number | null>(null);
  const currentDragRangeRef = useRef<{ start: number; end: number } | null>(
    null
  );
  const [isDraggingRange, setIsDraggingRange] = useState(false);

  const { execute } = useAudioCommand();
  const { showBoundary } = useErrorBoundary();

  const maxDuration = useMemo(() => getMaxDuration(trackArray), [trackArray]);

  const showExportRange =
    exportStartTime !== null &&
    exportEndTime !== null &&
    exportStartTime !== exportEndTime;

  // Handle global mouse events for dragging
  useEffect(() => {
    if (!isDraggingRange) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (
        !containerRef.current ||
        dragStartPosRef.current === null ||
        !overlayRef.current
      )
        return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const time = Math.max(0, x / pixelsPerSecond);

      const start = Math.min(dragStartPosRef.current, time);
      const end = Math.max(dragStartPosRef.current, time);

      currentDragRangeRef.current = { start, end };

      // Direct DOM manipulation for performance
      overlayRef.current.style.left = `${start * pixelsPerSecond}px`;
      overlayRef.current.style.width = `${(end - start) * pixelsPerSecond}px`;
    };

    const handleWindowMouseUp = async () => {
      setIsDraggingRange(false);
      dragStartPosRef.current = null;

      if (currentDragRangeRef.current) {
        try {
          await execute({
            type: AudioCommandType.SET_EXPORT_RANGE,
            startTime: currentDragRangeRef.current.start,
            endTime: currentDragRangeRef.current.end,
          });
        } catch (error) {
          showBoundary(error);
        }
        currentDragRangeRef.current = null;
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isDraggingRange, pixelsPerSecond, execute, showBoundary]);

  const ticks = useMemo(() => {
    const tickElements = [];
    const step = 1; // 1 second steps
    // Ensure we render enough ticks for the max duration or at least visible area
    const renderDuration = Math.max(maxDuration, 300);

    for (let i = 0; i <= renderDuration; i += step) {
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

  // Zone specific handlers
  const handleTopMouseDown = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = Math.max(0, x / pixelsPerSecond);

    dragStartPosRef.current = time;
    currentDragRangeRef.current = { start: time, end: time };

    // Init range via execute (optional, could be skipped if we trust visual feedback only until mouseup)
    try {
      await execute({
        type: AudioCommandType.SET_EXPORT_RANGE,
        startTime: time,
        endTime: time,
      });
    } catch (error) {
      showBoundary(error);
    }

    setIsDraggingRange(true);
  };

  const handleBottomMouseDown = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Logic for setting playhead (handled by click on container originally, but better isolated here)
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = Math.max(0, x / pixelsPerSecond);

    try {
      await execute({
        type: AudioCommandType.SET_CURRENT_TIME,
        time,
      });
    } catch (error) {
      showBoundary(error);
    }
  };

  const handleDoubleClick = async () => {
    try {
      await execute({
        type: AudioCommandType.CLEAR_EXPORT_RANGE,
      });
    } catch (error) {
      showBoundary(error);
    }
  };

  return (
    <div
      className={styles.container}
      ref={containerRef}
      onDoubleClick={handleDoubleClick}
    >
      {ticks}

      {/* Export Range Overlay */}
      <div
        ref={overlayRef}
        className={styles.exportRangeOverlay}
        style={{
          display: showExportRange || isDraggingRange ? 'block' : 'none',
          left: `${(exportStartTime ?? 0) * pixelsPerSecond}px`,
          width: `${((exportEndTime ?? 0) - (exportStartTime ?? 0)) * pixelsPerSecond}px`,
        }}
      >
        <span className={styles.exportRangeLabel}>Export Range</span>
      </div>

      {/* Interactive Zones */}
      <div
        className={styles.topZone}
        onMouseDown={handleTopMouseDown}
        title="Drag to Select Export Range. Double click to clear."
      />
      <div
        className={styles.bottomZone}
        onMouseDown={handleBottomMouseDown}
        title="Click to Set Playhead"
      />
    </div>
  );
});

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getMaxDuration(tracks: Track[]) {
  let max = 0;
  tracks.forEach(track => {
    track.regions.forEach(region => {
      // AudioFile property mismatch handling if needed
      // Snapshot region has audioFile which has duration
      const duration = region.audioFile?.duration ?? region.duration ?? 0;
      const endTime = region.startTime + duration;
      if (endTime > max) max = endTime;
    });
  });
  return max;
}
