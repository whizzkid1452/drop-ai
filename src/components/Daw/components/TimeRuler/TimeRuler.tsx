import { memo, useMemo, useRef, useState, useEffect } from 'react';
import { useTrackStore } from '@/stores/useTrackStore';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import * as styles from './TimeRuler.css';
import type { Track } from '@/types/track';
import { useAudioEngineHandleWithUi } from '@/hooks/agent/useAudioEngineHandleWithUi';
import { AudioCommandType } from '@/types/audioCommand.schema';
import { useShallow } from 'zustand/react/shallow';

export const TimeRuler = memo(() => {
  const tracks = useTrackStore(state => state.tracks);
  const {
    pixelsPerSecond,
    exportStartTime,
    exportEndTime,
    setExportRange,
  } = usePlaybackStore(
    useShallow(state => ({
      pixelsPerSecond: state.pixelsPerSecond,
      exportStartTime: state.exportStartTime,
      exportEndTime: state.exportEndTime,
      setExportRange: state.setExportRange,
    }))
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragStartPosRef = useRef<number | null>(null);
  const currentDragRangeRef = useRef<{ start: number; end: number } | null>(null);
  const [isDraggingRange, setIsDraggingRange] = useState(false);

  const maxDuration = useMemo(() => getMaxDuration(tracks), [tracks]);

  const showExportRange = exportStartTime !== null && exportEndTime !== null && exportStartTime !== exportEndTime;

  // Handle global mouse events for dragging
  useEffect(() => {
    if (!isDraggingRange) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || dragStartPosRef.current === null || !overlayRef.current) return;
      
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

    const handleWindowMouseUp = () => {
      setIsDraggingRange(false);
      dragStartPosRef.current = null;
      
      if (currentDragRangeRef.current) {
        setExportRange(currentDragRangeRef.current.start, currentDragRangeRef.current.end);
        currentDragRangeRef.current = null;
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isDraggingRange, pixelsPerSecond, setExportRange]);


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

  const { handleAudioCommand } = useAudioEngineHandleWithUi();

  // Zone specific handlers
  const handleTopMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = Math.max(0, x / pixelsPerSecond);
    
    dragStartPosRef.current = time;
    currentDragRangeRef.current = { start: time, end: time };
    setExportRange(time, time); // Init with 0 duration
    setIsDraggingRange(true);
  };

  const handleBottomMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Logic for setting playhead (handled by click on container originally, but better isolated here)
     if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = Math.max(0, x / pixelsPerSecond);

    handleAudioCommand({
      type: AudioCommandType.SET_CURRENT_TIME,
      time,
    });
  };

  const handleDoubleClick = () => {
      setExportRange(null, null);
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
            width: `${((exportEndTime ?? 0) - (exportStartTime ?? 0)) * pixelsPerSecond}px`
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
