import { useRef, useState, type PointerEvent } from 'react';
import { useCommandExecutor, usePlaybackClock, useSession } from '@/layers/apps/web/context/layer-hooks';
import type {
  TimelineCoordinateMapper,
  TimelineMeterChange,
  TimelineTempoChange,
} from '@/layers/shared/timeline-coordinate-mapper';
import { AudioCommandType } from '@/types/audioCommand.schema';
import { snapTimelineSeconds, type TimelineGridSettings } from '../../timeline-grid';
import {
  moveMeterChange,
  moveTempoChange,
  removeMeterChange,
  removeTempoChange,
  snapQuarterNotesToBar,
  upsertMeterChange,
  upsertTempoChange,
} from '../../timeline-map-edits';
import * as styles from './TempoMeterRuler.css.ts';

interface TempoMeterRulerProps {
  readonly coordinateMapper: TimelineCoordinateMapper;
  readonly gridSettings: TimelineGridSettings;
  readonly timelineContentWidth: number;
}

interface MarkerDrag {
  readonly kind: 'meter' | 'tempo';
  readonly sourceQuarterNotePosition: number;
  readonly targetQuarterNotePosition: number;
}

export function TempoMeterRuler({ coordinateMapper, gridSettings, timelineContentWidth }: TempoMeterRulerProps) {
  const tempoChanges = useSession(state => state.tempoChanges);
  const meterChanges = useSession(state => state.meterChanges);
  const commandExecutor = useCommandExecutor();
  const playbackClock = usePlaybackClock();
  const tempoLaneRef = useRef<HTMLDivElement>(null);
  const meterLaneRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<MarkerDrag | null>(null);
  const [dragPreview, setDragPreview] = useState<MarkerDrag | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const executeTimelineMap = async (
    nextTempoChanges: readonly TimelineTempoChange[],
    nextMeterChanges: readonly TimelineMeterChange[]
  ) => {
    try {
      await commandExecutor.execute({
        type: AudioCommandType.SET_TIMELINE_MAP,
        tempoChanges: nextTempoChanges.map(change => ({ ...change })),
        meterChanges: nextMeterChanges.map(change => ({ ...change })),
      });
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const handleAddTempo = () => {
    const currentQuarterNotes = coordinateMapper.secondsToQuarterNotes(playbackClock.getCurrentTime());
    const snappedSeconds = snapTimelineSeconds({
      coordinateMapper,
      division: gridSettings.division,
      mode: gridSettings.snapMode,
      seconds: coordinateMapper.quarterNotesToSeconds(currentQuarterNotes),
    });
    const quarterNotePosition = normalizeQuarterNotes(coordinateMapper.secondsToQuarterNotes(snappedSeconds));
    const activeTempo = findLastChange(tempoChanges, quarterNotePosition)?.bpm ?? coordinateMapper.tempoBpm;
    void executeTimelineMap(upsertTempoChange(tempoChanges, { quarterNotePosition, bpm: activeTempo }), meterChanges);
  };

  const handleAddMeter = () => {
    const currentQuarterNotes = coordinateMapper.secondsToQuarterNotes(playbackClock.getCurrentTime());
    const quarterNotePosition = normalizeQuarterNotes(snapQuarterNotesToBar(coordinateMapper, currentQuarterNotes));
    const activeMeter = coordinateMapper.getMeterAtQuarterNotes(quarterNotePosition);
    void executeTimelineMap(
      tempoChanges,
      upsertMeterChange(meterChanges, {
        quarterNotePosition,
        beatsPerBar: activeMeter.beatsPerBar,
        beatUnit: activeMeter.beatUnit,
      })
    );
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>, kind: MarkerDrag['kind']) => {
    const drag = dragRef.current;
    if (!drag || drag.kind !== kind) {
      return;
    }
    const targetQuarterNotePosition = resolveDragQuarterNotes(event.clientX, kind);
    const nextDrag = { ...drag, targetQuarterNotePosition };
    dragRef.current = nextDrag;
    setDragPreview(nextDrag);
  };

  const handlePointerUp = (event: PointerEvent<HTMLElement>, kind: MarkerDrag['kind']) => {
    const drag = dragRef.current;
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setDragPreview(null);
    if (!drag || drag.kind !== kind || drag.sourceQuarterNotePosition === drag.targetQuarterNotePosition) {
      return;
    }
    if (kind === 'tempo') {
      void executeTimelineMap(
        moveTempoChange(tempoChanges, drag.sourceQuarterNotePosition, drag.targetQuarterNotePosition),
        meterChanges
      );
      return;
    }
    void executeTimelineMap(
      tempoChanges,
      moveMeterChange(meterChanges, drag.sourceQuarterNotePosition, drag.targetQuarterNotePosition)
    );
  };

  const resolveDragQuarterNotes = (clientX: number, kind: MarkerDrag['kind']): number => {
    const lane = kind === 'tempo' ? tempoLaneRef.current : meterLaneRef.current;
    if (!lane) {
      return 0;
    }
    const rawQuarterNotes =
      Math.max(0, clientX - lane.getBoundingClientRect().left) / coordinateMapper.pixelsPerQuarterNote;
    if (kind === 'meter') {
      return normalizeQuarterNotes(snapQuarterNotesToBar(coordinateMapper, rawQuarterNotes));
    }
    const snappedSeconds = snapTimelineSeconds({
      coordinateMapper,
      division: gridSettings.division,
      mode: gridSettings.snapMode,
      seconds: coordinateMapper.quarterNotesToSeconds(rawQuarterNotes),
    });
    return normalizeQuarterNotes(coordinateMapper.secondsToQuarterNotes(snappedSeconds));
  };

  const startDrag = (event: PointerEvent<HTMLElement>, kind: MarkerDrag['kind'], sourceQuarterNotePosition: number) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const drag = { kind, sourceQuarterNotePosition, targetQuarterNotePosition: sourceQuarterNotePosition };
    dragRef.current = drag;
    setDragPreview(drag);
  };

  return (
    <div className={styles.container} style={{ width: `${timelineContentWidth}px` }}>
      <div className={styles.lane} ref={tempoLaneRef} aria-label="Tempo Map">
        <button className={styles.addButton} type="button" onClick={handleAddTempo}>
          + Tempo
        </button>
        {tempoChanges.map(change => {
          const markerPosition = getMarkerPosition(change.quarterNotePosition, 'tempo', dragPreview);
          return (
            <div
              className={styles.marker}
              key={`tempo:${change.quarterNotePosition}:${change.bpm}`}
              style={{ left: `${markerPosition * coordinateMapper.pixelsPerQuarterNote}px` }}
            >
              {change.quarterNotePosition > 0 ? (
                <span
                  className={styles.dragHandle}
                  onPointerDown={event => startDrag(event, 'tempo', change.quarterNotePosition)}
                  onPointerMove={event => handlePointerMove(event, 'tempo')}
                  onPointerUp={event => handlePointerUp(event, 'tempo')}
                  title="Tempo marker 이동"
                />
              ) : null}
              <input
                aria-label={`${change.quarterNotePosition} quarter note Tempo`}
                className={styles.valueInput}
                defaultValue={change.bpm}
                min={1}
                step={0.1}
                type="number"
                onBlur={event => {
                  const bpm = Number(event.currentTarget.value);
                  if (!Number.isFinite(bpm) || bpm <= 0) {
                    event.currentTarget.value = change.bpm.toString();
                    return;
                  }
                  void executeTimelineMap(upsertTempoChange(tempoChanges, { ...change, bpm }), meterChanges);
                }}
              />
              <span className={styles.unit}>BPM</span>
              {change.quarterNotePosition > 0 ? (
                <button
                  aria-label="Tempo marker 삭제"
                  className={styles.deleteButton}
                  type="button"
                  onClick={() =>
                    void executeTimelineMap(removeTempoChange(tempoChanges, change.quarterNotePosition), meterChanges)
                  }
                >
                  ×
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className={styles.lane} ref={meterLaneRef} aria-label="Meter Map">
        <button className={styles.addButton} type="button" onClick={handleAddMeter}>
          + Meter
        </button>
        {meterChanges.map(change => {
          const markerPosition = getMarkerPosition(change.quarterNotePosition, 'meter', dragPreview);
          return (
            <div
              className={`${styles.marker} ${styles.meterMarker}`}
              key={`meter:${change.quarterNotePosition}:${change.beatsPerBar}:${change.beatUnit}`}
              style={{ left: `${markerPosition * coordinateMapper.pixelsPerQuarterNote}px` }}
            >
              {change.quarterNotePosition > 0 ? (
                <span
                  className={styles.dragHandle}
                  onPointerDown={event => startDrag(event, 'meter', change.quarterNotePosition)}
                  onPointerMove={event => handlePointerMove(event, 'meter')}
                  onPointerUp={event => handlePointerUp(event, 'meter')}
                  title="Meter marker 이동"
                />
              ) : null}
              <input
                aria-label={`${change.quarterNotePosition} quarter note Meter numerator`}
                className={styles.meterInput}
                defaultValue={change.beatsPerBar}
                min={1}
                step={1}
                type="number"
                onBlur={event => {
                  const beatsPerBar = Number(event.currentTarget.value);
                  if (!Number.isInteger(beatsPerBar) || beatsPerBar <= 0) {
                    event.currentTarget.value = change.beatsPerBar.toString();
                    return;
                  }
                  void executeTimelineMap(tempoChanges, upsertMeterChange(meterChanges, { ...change, beatsPerBar }));
                }}
              />
              <span className={styles.unit}>/</span>
              <select
                aria-label={`${change.quarterNotePosition} quarter note Meter denominator`}
                className={styles.beatUnitSelect}
                defaultValue={change.beatUnit}
                onChange={event =>
                  void executeTimelineMap(
                    tempoChanges,
                    upsertMeterChange(meterChanges, { ...change, beatUnit: Number(event.currentTarget.value) })
                  )
                }
              >
                {[1, 2, 4, 8, 16, 32].map(beatUnit => (
                  <option key={beatUnit} value={beatUnit}>
                    {beatUnit}
                  </option>
                ))}
              </select>
              {change.quarterNotePosition > 0 ? (
                <button
                  aria-label="Meter marker 삭제"
                  className={styles.deleteButton}
                  type="button"
                  onClick={() =>
                    void executeTimelineMap(tempoChanges, removeMeterChange(meterChanges, change.quarterNotePosition))
                  }
                >
                  ×
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {errorMessage ? (
        <output className={styles.errorMessage} aria-live="polite">
          {errorMessage}
        </output>
      ) : null}
    </div>
  );
}

function findLastChange<Change extends { readonly quarterNotePosition: number }>(
  changes: readonly Change[],
  quarterNotePosition: number
): Change | undefined {
  return [...changes].reverse().find(change => change.quarterNotePosition <= quarterNotePosition);
}

function getMarkerPosition(
  originalQuarterNotePosition: number,
  kind: MarkerDrag['kind'],
  dragPreview: MarkerDrag | null
): number {
  return dragPreview?.kind === kind && dragPreview.sourceQuarterNotePosition === originalQuarterNotePosition
    ? dragPreview.targetQuarterNotePosition
    : originalQuarterNotePosition;
}

function normalizeQuarterNotes(quarterNotes: number): number {
  return Math.round(quarterNotes * 1_000_000) / 1_000_000;
}
