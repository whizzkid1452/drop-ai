import type { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';

export type TimelineGridDivision = 'bar' | 'beat' | 'halfBeat' | 'quarterBeat' | 'eighthBeat' | 'sixteenthBeat';
export type TimelineSnapMode = 'off' | 'grid' | 'magnetic';

export interface TimelineGridSettings {
  readonly division: TimelineGridDivision;
  readonly snapMode: TimelineSnapMode;
}

interface GetTimelineGridStepOptions {
  readonly coordinateMapper: TimelineCoordinateMapper;
  readonly division: TimelineGridDivision;
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

export function getTimelineGridStepQuarterNotes({ coordinateMapper, division }: GetTimelineGridStepOptions): number {
  if (division === 'bar') {
    return coordinateMapper.meterBeatQuarterNotes * coordinateMapper.beatsPerBar;
  }
  return coordinateMapper.meterBeatQuarterNotes * DIVISION_BEAT_FACTORS[division];
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

  const gridStepQuarterNotes = getTimelineGridStepQuarterNotes({ coordinateMapper, division });
  const quarterNotes = coordinateMapper.secondsToQuarterNotes(nonNegativeSeconds);
  const snappedQuarterNotes = Math.round(quarterNotes / gridStepQuarterNotes) * gridStepQuarterNotes;
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
