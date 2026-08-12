import type { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';

export type TimelineGridDivision = 'bar' | 'beat' | 'halfBeat' | 'quarterBeat' | 'eighthBeat' | 'sixteenthBeat';
export type TimelineSnapMode = 'off' | 'grid' | 'magnetic';

export interface TimelineGridSettings {
  readonly division: TimelineGridDivision;
  readonly snapMode: TimelineSnapMode;
}

export interface TimelineGridLine {
  readonly level: 'bar' | 'division';
  readonly pixel: number;
  readonly quarterNotePosition: number;
}

interface GetTimelineGridStepOptions {
  readonly coordinateMapper: TimelineCoordinateMapper;
  readonly division: TimelineGridDivision;
  readonly quarterNotePosition?: number;
}

interface CreateTimelineGridLinesOptions extends GetTimelineGridStepOptions {
  readonly endQuarterNotes: number;
}

interface SnapTimelineSecondsOptions extends GetTimelineGridStepOptions {
  readonly magneticThresholdPixels?: number;
  readonly mode: TimelineSnapMode;
  readonly seconds: number;
}

const DIVISION_BEAT_FACTORS: Record<TimelineGridDivision, number> = {
  bar: 1,
  beat: 1,
  halfBeat: 1 / 2,
  quarterBeat: 1 / 4,
  eighthBeat: 1 / 8,
  sixteenthBeat: 1 / 16,
};
const MIN_GRID_LINE_GAP_PX = 4;
const FLOATING_POINT_EPSILON = 1e-9;

export function createTimelineGridLines({
  coordinateMapper,
  division,
  endQuarterNotes,
}: CreateTimelineGridLinesOptions): TimelineGridLine[] {
  const lines: TimelineGridLine[] = [];

  for (let quarterNotePosition = 0; quarterNotePosition <= endQuarterNotes + FLOATING_POINT_EPSILON; ) {
    const requestedStep = getTimelineGridStepQuarterNotes({ coordinateMapper, division, quarterNotePosition });
    const barStep = getTimelineGridStepQuarterNotes({
      coordinateMapper,
      division: 'bar',
      quarterNotePosition,
    });
    const step =
      requestedStep * coordinateMapper.pixelsPerQuarterNote >= MIN_GRID_LINE_GAP_PX ? requestedStep : barStep;
    const position = coordinateMapper.secondsToBBT(coordinateMapper.quarterNotesToSeconds(quarterNotePosition));
    lines.push({
      level: position.beat === 1 && position.tick === 0 ? 'bar' : 'division',
      pixel: quarterNotePosition * coordinateMapper.pixelsPerQuarterNote,
      quarterNotePosition,
    });
    quarterNotePosition += step;
  }

  return lines;
}

export function getTimelineGridStepQuarterNotes({
  coordinateMapper,
  division,
  quarterNotePosition = 0,
}: GetTimelineGridStepOptions): number {
  const meter = coordinateMapper.getMeterAtQuarterNotes(Math.max(0, quarterNotePosition));
  const meterBeatQuarterNotes = 4 / meter.beatUnit;
  if (division === 'bar') {
    return meterBeatQuarterNotes * meter.beatsPerBar;
  }
  return meterBeatQuarterNotes * DIVISION_BEAT_FACTORS[division];
}

export function snapTimelineSeconds({
  coordinateMapper,
  division,
  magneticThresholdPixels = 8,
  mode,
  seconds,
}: SnapTimelineSecondsOptions): number {
  const nonNegativeSeconds = Math.max(0, seconds);
  if (mode === 'off') {
    return nonNegativeSeconds;
  }

  const quarterNotes = coordinateMapper.secondsToQuarterNotes(nonNegativeSeconds);
  const meter = coordinateMapper.getMeterAtQuarterNotes(quarterNotes);
  const gridStepQuarterNotes = getTimelineGridStepQuarterNotes({
    coordinateMapper,
    division,
    quarterNotePosition: quarterNotes,
  });
  const localQuarterNotes = quarterNotes - meter.quarterNotePosition;
  const snappedQuarterNotes =
    meter.quarterNotePosition + Math.round(localQuarterNotes / gridStepQuarterNotes) * gridStepQuarterNotes;
  const snappedSeconds = coordinateMapper.quarterNotesToSeconds(snappedQuarterNotes);

  if (mode === 'grid') {
    return snappedSeconds;
  }

  // Magnetic 모드는 음악 시간 차이가 아니라 화면상 거리로 흡착 범위를 유지합니다.
  const pixelDistance = Math.abs(
    coordinateMapper.secondsToPixels(snappedSeconds) - coordinateMapper.secondsToPixels(nonNegativeSeconds)
  );
  return pixelDistance <= magneticThresholdPixels ? snappedSeconds : nonNegativeSeconds;
}
