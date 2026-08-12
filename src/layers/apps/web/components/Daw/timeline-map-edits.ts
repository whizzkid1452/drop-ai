import type {
  TimelineCoordinateMapper,
  TimelineMeterChange,
  TimelineTempoChange,
} from '@/layers/shared/timeline-coordinate-mapper';

export function upsertTempoChange(
  changes: readonly TimelineTempoChange[],
  nextChange: TimelineTempoChange
): TimelineTempoChange[] {
  return upsertTimelineChange(changes, nextChange);
}

export function upsertMeterChange(
  changes: readonly TimelineMeterChange[],
  nextChange: TimelineMeterChange
): TimelineMeterChange[] {
  return upsertTimelineChange(changes, nextChange);
}

export function removeTempoChange(
  changes: readonly TimelineTempoChange[],
  quarterNotePosition: number
): TimelineTempoChange[] {
  assertRemovableMarker('Tempo', quarterNotePosition);
  return changes.filter(change => change.quarterNotePosition !== quarterNotePosition);
}

export function removeMeterChange(
  changes: readonly TimelineMeterChange[],
  quarterNotePosition: number
): TimelineMeterChange[] {
  assertRemovableMarker('Meter', quarterNotePosition);
  return changes.filter(change => change.quarterNotePosition !== quarterNotePosition);
}

export function moveTempoChange(
  changes: readonly TimelineTempoChange[],
  sourceQuarterNotePosition: number,
  targetQuarterNotePosition: number
): TimelineTempoChange[] {
  return moveTimelineChange('Tempo', changes, sourceQuarterNotePosition, targetQuarterNotePosition);
}

export function moveMeterChange(
  changes: readonly TimelineMeterChange[],
  sourceQuarterNotePosition: number,
  targetQuarterNotePosition: number
): TimelineMeterChange[] {
  return moveTimelineChange('Meter', changes, sourceQuarterNotePosition, targetQuarterNotePosition);
}

export function snapQuarterNotesToBar(coordinateMapper: TimelineCoordinateMapper, quarterNotePosition: number): number {
  const seconds = coordinateMapper.quarterNotesToSeconds(Math.max(0, quarterNotePosition));
  const { bar } = coordinateMapper.secondsToBBT(seconds);
  return coordinateMapper.secondsToQuarterNotes(coordinateMapper.bbtToSeconds({ bar, beat: 1, tick: 0 }));
}

function upsertTimelineChange<Change extends { readonly quarterNotePosition: number }>(
  changes: readonly Change[],
  nextChange: Change
): Change[] {
  const withoutCurrentPosition = changes.filter(
    change => change.quarterNotePosition !== nextChange.quarterNotePosition
  );
  return [...withoutCurrentPosition, { ...nextChange }].sort(
    (left, right) => left.quarterNotePosition - right.quarterNotePosition
  );
}

function moveTimelineChange<Change extends { readonly quarterNotePosition: number }>(
  markerName: 'Tempo' | 'Meter',
  changes: readonly Change[],
  sourceQuarterNotePosition: number,
  targetQuarterNotePosition: number
): Change[] {
  assertRemovableMarker(markerName, sourceQuarterNotePosition);
  const source = changes.find(change => change.quarterNotePosition === sourceQuarterNotePosition);
  if (!source) {
    throw new Error(`${markerName} marker를 찾을 수 없습니다.`);
  }
  if (
    sourceQuarterNotePosition !== targetQuarterNotePosition &&
    changes.some(change => change.quarterNotePosition === targetQuarterNotePosition)
  ) {
    throw new Error(`이 위치에 ${markerName} marker가 이미 있습니다.`);
  }
  return upsertTimelineChange(
    changes.filter(change => change.quarterNotePosition !== sourceQuarterNotePosition),
    { ...source, quarterNotePosition: Math.max(0, targetQuarterNotePosition) }
  );
}

function assertRemovableMarker(markerName: 'Tempo' | 'Meter', quarterNotePosition: number): void {
  if (quarterNotePosition === 0) {
    throw new Error(`첫 ${markerName} marker는 삭제하거나 이동할 수 없습니다.`);
  }
}
