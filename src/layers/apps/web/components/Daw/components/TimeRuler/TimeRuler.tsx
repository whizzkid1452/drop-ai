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
import { getMaxDuration } from '../../get-max-duration';
import type { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';
import { createBBTRulerTicks } from './bbt-ruler-ticks';
import { TIMELINE_MIN_CONTENT_WIDTH_PX } from '../../timeline-content-width';

// ...

interface TimeRulerProps {
  coordinateMapper: TimelineCoordinateMapper;
}

export const TimeRuler = memo(function TimeRuler({ coordinateMapper }: TimeRulerProps) {
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
      const time = coordinateMapper.pixelsToSeconds(Math.max(0, x));

      const start = Math.min(dragStartPosRef.current, time);
      const end = Math.max(dragStartPosRef.current, time);

      currentDragRangeRef.current = { start, end };

      // Direct DOM manipulation for performance
      overlayRef.current.style.left = `${coordinateMapper.secondsToPixels(start)}px`;
      overlayRef.current.style.width = `${coordinateMapper.durationToPixels({
        startSeconds: start,
        durationSeconds: end - start,
      })}px`;
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
  }, [commandExecutor, coordinateMapper, isDraggingRange, showBoundary]);

  const ticks = useMemo(() => {
    const minimumVisibleDuration = coordinateMapper.pixelsToSeconds(TIMELINE_MIN_CONTENT_WIDTH_PX);
    const renderDuration = Math.max(maxDuration, minimumVisibleDuration);

    return createBBTRulerTicks({ coordinateMapper, endSeconds: renderDuration }).map(tick => {
      const tickLevelClass =
        tick.level === 'bar' ? styles.barTick : tick.level === 'beat' ? styles.beatTick : styles.subdivisionTick;
      return (
        <div
          key={`${tick.bar}:${tick.beat}:${tick.tick}`}
          className={`${styles.tick} ${tickLevelClass}`}
          style={{ left: `${tick.pixel}px` }}
        >
          {tick.label !== null ? <span className={styles.label}>{tick.label}</span> : null}
        </div>
      );
    });
  }, [coordinateMapper, maxDuration]);

  // Zone specific handlers
  const handleTopMouseDown = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = coordinateMapper.pixelsToSeconds(Math.max(0, x));

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
    const time = coordinateMapper.pixelsToSeconds(Math.max(0, x));

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

  const handleSeek = async (offsetQuarterNotes: number) => {
    const currentQuarterNotes = coordinateMapper.secondsToQuarterNotes(playbackClock.getCurrentTime());
    try {
      await commandExecutor.execute({
        type: AudioCommandType.SET_CURRENT_TIME,
        time: coordinateMapper.quarterNotesToSeconds(Math.max(0, currentQuarterNotes + offsetQuarterNotes)),
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
    void handleSeek(-coordinateMapper.meterBeatQuarterNotes);
  });
  useKeyboardShortcutAction(KeyboardShortcutAction.SEEK_FORWARD, () => {
    void handleSeek(coordinateMapper.meterBeatQuarterNotes);
  });
  useKeyboardShortcutAction(KeyboardShortcutAction.SEEK_BACKWARD_LARGE, () => {
    void handleSeek(-coordinateMapper.meterBeatQuarterNotes * coordinateMapper.beatsPerBar);
  });
  useKeyboardShortcutAction(KeyboardShortcutAction.SEEK_FORWARD_LARGE, () => {
    void handleSeek(coordinateMapper.meterBeatQuarterNotes * coordinateMapper.beatsPerBar);
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
          left: `${coordinateMapper.secondsToPixels(exportStartTime ?? 0)}px`,
          width: `${coordinateMapper.durationToPixels({
            startSeconds: exportStartTime ?? 0,
            durationSeconds: (exportEndTime ?? 0) - (exportStartTime ?? 0),
          })}px`,
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
