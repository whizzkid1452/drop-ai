import { useRef, useState, type PointerEvent } from 'react';
import { useCommandExecutor, usePlaybackClock, useSession } from '@/layers/apps/web/context/layer-hooks';
import {
  KeyboardShortcutAction,
  KEYBOARD_SHORTCUT_LABELS,
  useKeyboardShortcutAction,
} from '@/layers/apps/web/keyboard-shortcuts/keyboard-shortcuts';
import type { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';
import type { TimelineMarker } from '@/layers/shared/timeline-marker';
import { AudioCommandType } from '@/types/audioCommand.schema';
import { snapTimelineSeconds, type TimelineGridSettings } from '../../timeline-grid';
import {
  addTimelineMarker,
  moveTimelineMarker,
  removeTimelineMarker,
  renameTimelineMarker,
} from '../../timeline-marker-edits';
import * as styles from './MarkerRangeRuler.css.ts';

interface MarkerRangeRulerProps {
  readonly coordinateMapper: TimelineCoordinateMapper;
  readonly gridSettings: TimelineGridSettings;
  readonly timelineContentWidth: number;
}

interface MarkerDrag {
  readonly markerId: string;
  readonly quarterNotePosition: number;
}

interface RangeDrag {
  readonly anchorSeconds: number;
  readonly startSeconds: number;
  readonly endSeconds: number;
}

export function MarkerRangeRuler({ coordinateMapper, gridSettings, timelineContentWidth }: MarkerRangeRulerProps) {
  const timelineMarkers = useSession(state => state.timelineMarkers);
  const exportStartTime = useSession(state => state.exportStartTime);
  const exportEndTime = useSession(state => state.exportEndTime);
  const commandExecutor = useCommandExecutor();
  const playbackClock = usePlaybackClock();
  const markerLaneRef = useRef<HTMLDivElement>(null);
  const rangeLaneRef = useRef<HTMLDivElement>(null);
  const markerDragRef = useRef<MarkerDrag | null>(null);
  const rangeDragRef = useRef<RangeDrag | null>(null);
  const [markerDragPreview, setMarkerDragPreview] = useState<MarkerDrag | null>(null);
  const [rangeDragPreview, setRangeDragPreview] = useState<RangeDrag | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const executeMarkers = async (markers: readonly TimelineMarker[]) => {
    try {
      await commandExecutor.execute({
        type: AudioCommandType.SET_TIMELINE_MARKERS,
        markers: markers.map(marker => ({ ...marker })),
      });
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const executeRangeCommand = async (
    command:
      | { readonly type: typeof AudioCommandType.CLEAR_EXPORT_RANGE }
      | {
          readonly type: typeof AudioCommandType.SET_EXPORT_RANGE;
          readonly startTime: number;
          readonly endTime: number;
        }
  ) => {
    try {
      await commandExecutor.execute(command);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const resolveSnappedSeconds = (clientX: number, lane: HTMLDivElement): number =>
    snapTimelineSeconds({
      coordinateMapper,
      division: gridSettings.division,
      mode: gridSettings.snapMode,
      seconds: coordinateMapper.pixelsToSeconds(Math.max(0, clientX - lane.getBoundingClientRect().left)),
    });

  const resolveMarkerQuarterNotes = (clientX: number): number => {
    const lane = markerLaneRef.current;
    if (!lane) {
      return 0;
    }
    // Grid는 실제 화면 시간으로 흡착하지만 Marker는 Tempo 변경에도 박자를 유지하도록 음악 위치로 저장한다.
    return normalizeQuarterNotes(coordinateMapper.secondsToQuarterNotes(resolveSnappedSeconds(clientX, lane)));
  };

  const handleAddMarker = () => {
    const currentSeconds = playbackClock.getCurrentTime();
    const snappedSeconds = snapTimelineSeconds({
      coordinateMapper,
      division: gridSettings.division,
      mode: gridSettings.snapMode,
      seconds: currentSeconds,
    });
    const marker: TimelineMarker = {
      id: crypto.randomUUID(),
      name: `Marker ${timelineMarkers.length + 1}`,
      quarterNotePosition: normalizeQuarterNotes(coordinateMapper.secondsToQuarterNotes(snappedSeconds)),
    };
    void executeMarkers(addTimelineMarker(timelineMarkers, marker));
  };

  const startMarkerDrag = (event: PointerEvent<HTMLElement>, marker: TimelineMarker) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const drag = { markerId: marker.id, quarterNotePosition: marker.quarterNotePosition };
    markerDragRef.current = drag;
    setMarkerDragPreview(drag);
  };

  const handleMarkerPointerMove = (event: PointerEvent<HTMLElement>) => {
    const drag = markerDragRef.current;
    if (!drag) {
      return;
    }
    const nextDrag = { ...drag, quarterNotePosition: resolveMarkerQuarterNotes(event.clientX) };
    markerDragRef.current = nextDrag;
    setMarkerDragPreview(nextDrag);
  };

  const handleMarkerPointerUp = (event: PointerEvent<HTMLElement>) => {
    const drag = markerDragRef.current;
    event.currentTarget.releasePointerCapture(event.pointerId);
    markerDragRef.current = null;
    setMarkerDragPreview(null);
    if (!drag) {
      return;
    }
    const marker = timelineMarkers.find(candidate => candidate.id === drag.markerId);
    if (!marker || marker.quarterNotePosition === drag.quarterNotePosition) {
      return;
    }
    void executeMarkers(moveTimelineMarker(timelineMarkers, drag.markerId, drag.quarterNotePosition));
  };

  const handleRangePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const seconds = resolveSnappedSeconds(event.clientX, event.currentTarget);
    const drag = { anchorSeconds: seconds, startSeconds: seconds, endSeconds: seconds };
    rangeDragRef.current = drag;
    setRangeDragPreview(drag);
  };

  const handleRangePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = rangeDragRef.current;
    if (!drag) {
      return;
    }
    const seconds = resolveSnappedSeconds(event.clientX, event.currentTarget);
    const nextDrag = {
      anchorSeconds: drag.anchorSeconds,
      startSeconds: Math.min(drag.anchorSeconds, seconds),
      endSeconds: Math.max(drag.anchorSeconds, seconds),
    };
    rangeDragRef.current = nextDrag;
    setRangeDragPreview(nextDrag);
  };

  const handleRangePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = rangeDragRef.current;
    event.currentTarget.releasePointerCapture(event.pointerId);
    rangeDragRef.current = null;
    setRangeDragPreview(null);
    if (!drag) {
      return;
    }
    void executeRangeCommand({
      type: AudioCommandType.SET_EXPORT_RANGE,
      startTime: drag.startSeconds,
      endTime: drag.endSeconds,
    });
  };

  const handleClearRange = () => {
    void executeRangeCommand({ type: AudioCommandType.CLEAR_EXPORT_RANGE });
  };

  useKeyboardShortcutAction(KeyboardShortcutAction.CLEAR_EXPORT_RANGE, handleClearRange);

  const visibleRange =
    rangeDragPreview ??
    (exportStartTime !== null && exportEndTime !== null
      ? { anchorSeconds: exportStartTime, startSeconds: exportStartTime, endSeconds: exportEndTime }
      : null);

  return (
    <div className={styles.container} style={{ width: `${timelineContentWidth}px` }}>
      <div className={styles.lane} ref={markerLaneRef} aria-label="Timeline Markers">
        <button className={styles.addButton} type="button" onClick={handleAddMarker}>
          + Marker
        </button>
        {timelineMarkers.map(marker => {
          const quarterNotePosition =
            markerDragPreview?.markerId === marker.id
              ? markerDragPreview.quarterNotePosition
              : marker.quarterNotePosition;
          return (
            <div
              className={styles.marker}
              key={marker.id}
              style={{ left: `${quarterNotePosition * coordinateMapper.pixelsPerQuarterNote}px` }}
            >
              <span
                className={styles.dragHandle}
                onPointerDown={event => startMarkerDrag(event, marker)}
                onPointerMove={handleMarkerPointerMove}
                onPointerUp={handleMarkerPointerUp}
                title="Marker 이동"
              />
              <input
                aria-label={`${marker.name} marker 이름`}
                className={styles.markerInput}
                defaultValue={marker.name}
                maxLength={255}
                onBlur={event => {
                  const name = event.currentTarget.value.trim();
                  if (!name) {
                    event.currentTarget.value = marker.name;
                    return;
                  }
                  void executeMarkers(renameTimelineMarker(timelineMarkers, marker.id, name));
                }}
              />
              <button
                aria-label={`${marker.name} marker 삭제`}
                className={styles.deleteButton}
                type="button"
                onClick={() => void executeMarkers(removeTimelineMarker(timelineMarkers, marker.id))}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <div
        aria-label="Export Range"
        className={`${styles.lane} ${styles.rangeLane}`}
        ref={rangeLaneRef}
        title={`Drag to select Export Range. Double click or ${KEYBOARD_SHORTCUT_LABELS[KeyboardShortcutAction.CLEAR_EXPORT_RANGE]} to clear.`}
        onDoubleClick={handleClearRange}
        onPointerDown={handleRangePointerDown}
        onPointerMove={handleRangePointerMove}
        onPointerUp={handleRangePointerUp}
      >
        {visibleRange ? (
          <div
            className={styles.exportRange}
            data-testid="export-range"
            style={{
              left: `${coordinateMapper.secondsToPixels(visibleRange.startSeconds)}px`,
              width: `${coordinateMapper.durationToPixels({
                startSeconds: visibleRange.startSeconds,
                durationSeconds: visibleRange.endSeconds - visibleRange.startSeconds,
              })}px`,
            }}
          >
            <span className={styles.exportRangeLabel}>EXPORT</span>
          </div>
        ) : null}
        <button
          className={styles.clearButton}
          disabled={exportStartTime === null && exportEndTime === null}
          type="button"
          onPointerDown={event => event.stopPropagation()}
          onClick={handleClearRange}
        >
          Clear
        </button>
      </div>
      {errorMessage ? (
        <output className={styles.errorMessage} aria-live="polite">
          {errorMessage}
        </output>
      ) : null}
    </div>
  );
}

function normalizeQuarterNotes(quarterNotes: number): number {
  return Math.round(quarterNotes * 1_000_000) / 1_000_000;
}
