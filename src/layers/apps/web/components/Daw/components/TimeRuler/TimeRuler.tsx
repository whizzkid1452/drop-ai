import { memo, useMemo, useRef } from 'react';
import * as styles from './TimeRuler.css.ts';
import {
  useCommandExecutor,
  useEditorRuntimeState,
  usePlaybackClock,
  useSession,
} from '@/layers/apps/web/context/layer-hooks';
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
import { snapTimelineSeconds, type TimelineGridSettings } from '../../timeline-grid';

// ...

interface TimeRulerProps {
  coordinateMapper: TimelineCoordinateMapper;
  gridSettings: TimelineGridSettings;
}

export const TimeRuler = memo(function TimeRuler({ coordinateMapper, gridSettings }: TimeRulerProps) {
  const tracks = useSession(state => state.tracks);
  const commandExecutor = useCommandExecutor();
  const playbackClock = usePlaybackClock();
  const editorRuntime = useEditorRuntimeState();

  const trackArray = Array.from(tracks.values());

  const containerRef = useRef<HTMLDivElement>(null);

  const { showBoundary } = useErrorBoundary();

  const maxDuration = useMemo(() => getMaxDuration(trackArray), [trackArray]);

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

  const handleEditPointChange = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = resolveEditTime(x, coordinateMapper, gridSettings);

    try {
      await commandExecutor.executeMany([
        { type: AudioCommandType.SET_CURRENT_TIME, time },
        {
          type: AudioCommandType.SET_EDITOR_SELECTION,
          editPointSeconds: time,
          range: editorRuntime.selection.range
            ? { ...editorRuntime.selection.range, trackIds: [...editorRuntime.selection.range.trackIds] }
            : null,
          regions: editorRuntime.selection.regions.map(region => ({ ...region })),
          trackIds: [...editorRuntime.selection.trackIds],
        },
      ]);
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
  return (
    <div className={styles.container} ref={containerRef}>
      {ticks}
      <button
        type="button"
        className={styles.interactionZone}
        aria-label="Timeline edit point"
        onClick={handleEditPointChange}
        title={`Click to Set Playhead. ${KEYBOARD_SHORTCUT_LABELS[KeyboardShortcutAction.SEEK_BACKWARD]}/${KEYBOARD_SHORTCUT_LABELS[KeyboardShortcutAction.SEEK_FORWARD]} to seek.`}
      />
    </div>
  );
});

function resolveEditTime(
  pixel: number,
  coordinateMapper: TimelineCoordinateMapper,
  gridSettings: TimelineGridSettings
): number {
  return snapTimelineSeconds({
    coordinateMapper,
    division: gridSettings.division,
    mode: gridSettings.snapMode,
    seconds: coordinateMapper.pixelsToSeconds(Math.max(0, pixel)),
  });
}
