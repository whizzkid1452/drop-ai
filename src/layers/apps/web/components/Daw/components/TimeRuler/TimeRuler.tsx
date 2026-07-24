import { memo, useMemo, useRef, useState, useEffect } from 'react';
import * as styles from './TimeRuler.css.ts';
import { useCommandExecutor, usePlaybackClock, useSession } from '@/layers/apps/web/context/layer-hooks';
import { useErrorBoundary } from 'react-error-boundary';
import {
  KeyboardShortcutAction,
  KEYBOARD_SHORTCUT_LABELS,
  useKeyboardShortcutAction,
} from '@/layers/apps/web/keyboard-shortcuts/keyboard-shortcuts';
import { AudioCommandType } from '@/types/audioCommand.schema';
import { getMaxDuration } from './get-max-duration';

// ...

const LARGE_SEEK_STEP_SECONDS = 5;
const SEEK_STEP_SECONDS = 1;

interface TimeRulerProps {
  pixelsPerSecond: number;
}

export const TimeRuler = memo(function TimeRuler({ pixelsPerSecond }: TimeRulerProps) {
  const tracks = useSession(state => state.tracks);
  const exportStartTime = useSession(state => state.exportStartTime);
  const exportEndTime = useSession(state => state.exportEndTime);

  const commandExecutor = useCommandExecutor();
  const playbackClock = usePlaybackClock();

  const trackArray = Array.from(tracks.values());

  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragStartPosRef = useRef<number | null>(null);
  const currentDragRangeRef = useRef<{ start: number; end: number } | null>(null);
  const [isDraggingRange, setIsDraggingRange] = useState(false);

  const { showBoundary } = useErrorBoundary();

  const maxDuration = useMemo(() => getMaxDuration(trackArray), [trackArray]);

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

    const handleWindowMouseUp = async () => {
      setIsDraggingRange(false);
      dragStartPosRef.current = null;

      if (currentDragRangeRef.current) {
        try {
          await commandExecutor.execute({
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
  }, [isDraggingRange, pixelsPerSecond, commandExecutor, showBoundary]);

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
      await commandExecutor.execute({
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
      await commandExecutor.execute({
        type: AudioCommandType.SET_CURRENT_TIME,
        time,
      });
    } catch (error) {
      showBoundary(error);
    }
  };

  const handleDoubleClick = async () => {
    try {
      await commandExecutor.execute({
        type: AudioCommandType.CLEAR_EXPORT_RANGE,
      });
    } catch (error) {
      showBoundary(error);
    }
  };

  const handleSeek = async (offsetSeconds: number) => {
    try {
      await commandExecutor.execute({
        type: AudioCommandType.SET_CURRENT_TIME,
        time: Math.max(0, playbackClock.getCurrentTime() + offsetSeconds),
      });
    } catch (error) {
      showBoundary(error);
    }
  };

  const handleSeekToStart = async () => {
    try {
      await commandExecutor.execute({
        type: AudioCommandType.SET_CURRENT_TIME,
        time: 0,
      });
    } catch (error) {
      showBoundary(error);
    }
  };

  useKeyboardShortcutAction(KeyboardShortcutAction.SEEK_TO_START, () => {
    void handleSeekToStart();
  });
  useKeyboardShortcutAction(KeyboardShortcutAction.SEEK_BACKWARD, () => {
    void handleSeek(-SEEK_STEP_SECONDS);
  });
  useKeyboardShortcutAction(KeyboardShortcutAction.SEEK_FORWARD, () => {
    void handleSeek(SEEK_STEP_SECONDS);
  });
  useKeyboardShortcutAction(KeyboardShortcutAction.SEEK_BACKWARD_LARGE, () => {
    void handleSeek(-LARGE_SEEK_STEP_SECONDS);
  });
  useKeyboardShortcutAction(KeyboardShortcutAction.SEEK_FORWARD_LARGE, () => {
    void handleSeek(LARGE_SEEK_STEP_SECONDS);
  });
  useKeyboardShortcutAction(KeyboardShortcutAction.CLEAR_EXPORT_RANGE, () => {
    void handleDoubleClick();
  });

  return (
    <div className={styles.container} ref={containerRef} onDoubleClick={handleDoubleClick}>
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
        title={`Drag to Select Export Range. Double click or ${KEYBOARD_SHORTCUT_LABELS[KeyboardShortcutAction.CLEAR_EXPORT_RANGE]} to clear.`}
      />
      <div
        className={styles.bottomZone}
        onMouseDown={handleBottomMouseDown}
        title={`Click to Set Playhead. ${KEYBOARD_SHORTCUT_LABELS[KeyboardShortcutAction.SEEK_BACKWARD]}/${KEYBOARD_SHORTCUT_LABELS[KeyboardShortcutAction.SEEK_FORWARD]} to seek.`}
      />
    </div>
  );
});

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
