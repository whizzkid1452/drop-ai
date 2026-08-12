import type { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';

const BAR_LABEL_MIN_GAP_PX = 64;
const BEAT_TICK_MIN_GAP_PX = 12;
const HALF_BEAT_TICK_MIN_GAP_PX = 48;
const QUARTER_BEAT_TICK_MIN_GAP_PX = 96;
const FLOATING_POINT_EPSILON = 1e-9;

export type BBTRulerTickLevel = 'bar' | 'beat' | 'subdivision';

export interface BBTRulerTick {
  readonly bar: number;
  readonly beat: number;
  readonly tick: number;
  readonly level: BBTRulerTickLevel;
  readonly label: string | null;
  readonly seconds: number;
  readonly pixel: number;
}

interface CreateBBTRulerTicksOptions {
  readonly coordinateMapper: TimelineCoordinateMapper;
  readonly endSeconds: number;
  readonly startSeconds?: number;
}

export function createBBTRulerTicks({
  coordinateMapper,
  endSeconds,
  startSeconds = 0,
}: CreateBBTRulerTicksOptions): BBTRulerTick[] {
  if (endSeconds < startSeconds || endSeconds < 0) {
    return [];
  }

  // 같은 BBT 데이터라도 확대 배율에 따라 subdivision 밀도를 줄여 label 겹침을 막습니다.
  const startQuarterNotes = coordinateMapper.secondsToQuarterNotes(Math.max(0, startSeconds));
  const endQuarterNotes = coordinateMapper.secondsToQuarterNotes(endSeconds);
  const startMeter = coordinateMapper.getMeterAtQuarterNotes(startQuarterNotes);
  const firstStepQuarterNotes = getTickStepForMeter(coordinateMapper, startMeter);
  const firstQuarterNotes =
    startMeter.quarterNotePosition +
    Math.floor((startQuarterNotes - startMeter.quarterNotePosition) / firstStepQuarterNotes) * firstStepQuarterNotes;
  const ticks: BBTRulerTick[] = [];

  for (let quarterNotes = firstQuarterNotes; quarterNotes <= endQuarterNotes + FLOATING_POINT_EPSILON; ) {
    const meter = coordinateMapper.getMeterAtQuarterNotes(quarterNotes);
    const stepQuarterNotes = getTickStepForMeter(coordinateMapper, meter);
    const seconds = coordinateMapper.quarterNotesToSeconds(Math.max(0, quarterNotes));
    if (seconds + FLOATING_POINT_EPSILON < startSeconds) {
      quarterNotes += stepQuarterNotes;
      continue;
    }

    const position = coordinateMapper.secondsToBBT(seconds);
    const barPixels = (4 / meter.beatUnit) * meter.beatsPerBar * coordinateMapper.pixelsPerQuarterNote;
    const barLabelInterval = getBarLabelInterval(barPixels);
    const level = getTickLevel(position.beat, position.tick);
    const isLabelBar = level === 'bar' && (position.bar - 1) % barLabelInterval === 0;
    ticks.push({
      ...position,
      level,
      label: isLabelBar ? position.bar.toString() : null,
      seconds,
      pixel: coordinateMapper.secondsToPixels(seconds),
    });
    quarterNotes += stepQuarterNotes;
  }

  return ticks;
}

function getTickStepForMeter(
  coordinateMapper: TimelineCoordinateMapper,
  meter: ReturnType<TimelineCoordinateMapper['getMeterAtQuarterNotes']>
): number {
  const meterBeatQuarterNotes = 4 / meter.beatUnit;
  return getTickStepQuarterNotes({
    beatsPerBar: meter.beatsPerBar,
    meterBeatPixels: meterBeatQuarterNotes * coordinateMapper.pixelsPerQuarterNote,
    meterBeatQuarterNotes,
  });
}

function getTickStepQuarterNotes({
  beatsPerBar,
  meterBeatPixels,
  meterBeatQuarterNotes,
}: {
  beatsPerBar: number;
  meterBeatPixels: number;
  meterBeatQuarterNotes: number;
}): number {
  if (meterBeatPixels >= QUARTER_BEAT_TICK_MIN_GAP_PX) {
    return meterBeatQuarterNotes / 4;
  }
  if (meterBeatPixels >= HALF_BEAT_TICK_MIN_GAP_PX) {
    return meterBeatQuarterNotes / 2;
  }
  if (meterBeatPixels >= BEAT_TICK_MIN_GAP_PX) {
    return meterBeatQuarterNotes;
  }
  return meterBeatQuarterNotes * beatsPerBar;
}

function getTickLevel(beat: number, tick: number): BBTRulerTickLevel {
  if (beat === 1 && tick === 0) {
    return 'bar';
  }
  if (tick === 0) {
    return 'beat';
  }
  return 'subdivision';
}

function getBarLabelInterval(barPixels: number): number {
  const requiredInterval = Math.max(1, Math.ceil(BAR_LABEL_MIN_GAP_PX / barPixels));
  // 1·2·4·8 마디 간격은 확대 전후에도 label 시작 마디를 안정적으로 유지합니다.
  const powerOfTwoInterval = 2 ** Math.ceil(Math.log2(requiredInterval));
  return Number.isFinite(powerOfTwoInterval) ? powerOfTwoInterval : 1;
}
