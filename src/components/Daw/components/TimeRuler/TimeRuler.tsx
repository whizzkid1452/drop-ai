import { memo, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAudioService } from '@/presentation/hooks/useAudioService';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import * as styles from './TimeRuler.css';
import type { Track } from '@/types/track';
import { getMaxDuration } from './utils/rulerUtils';
import { useInfiniteScroll } from './hooks/useInfiniteScroll';
import { useRulerInteraction } from './hooks/useRulerInteraction';
import { useRulerTicks } from './hooks/useRulerTicks';

export const TimeRuler = memo(() => {
  const { 
    tracks,
    exportStartTime,
    exportEndTime
  } = useAudioService(useShallow(state => ({
    tracks: state.tracks,
    exportStartTime: state.exportStartTime,
    exportEndTime: state.exportEndTime,
  })));
  
  const pixelsPerSecond = usePlaybackStore(state => state.pixelsPerSecond);
  const trackArray = (tracks || []) as unknown as Track[];

  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Max Duration Calculation (Utils)
  const maxDuration = useMemo(() => getMaxDuration(trackArray), [trackArray]);

  // 2. Infinite Scroll Logic (Hook)
  const { extraDuration, sentinelRef } = useInfiniteScroll(300);

  // 3. Ruler Ticks Generation (Hook)
  const ticks = useRulerTicks({ maxDuration, extraDuration, pixelsPerSecond });

  // 4. Interaction Logic (Hook)
  const { 
    isDraggingRange, 
    overlayRef, 
    handleTopMouseDown, 
    handleBottomMouseDown, 
    handleDoubleClick 
  } = useRulerInteraction({ pixelsPerSecond, containerRef: containerRef as React.RefObject<HTMLDivElement> });

  const showExportRange = exportStartTime !== null && exportEndTime !== null && exportStartTime !== exportEndTime;
  const totalWidth = (maxDuration + extraDuration) * pixelsPerSecond;

  return (
    <div
      className={styles.container}
      ref={containerRef}
      onDoubleClick={handleDoubleClick}
      style={{ minWidth: `${totalWidth}px` }}
    >
      {ticks}
      
      {/* Sentinel for infinite scroll */}
      <div
        ref={sentinelRef}
        style={{
          position: 'absolute',
          left: `${totalWidth - 50}px`,
          width: '1px',
          height: '100%',
          visibility: 'hidden',
          pointerEvents: 'none'
        }}
      />

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
