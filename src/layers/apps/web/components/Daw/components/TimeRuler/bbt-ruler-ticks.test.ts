import { describe, expect, it } from 'vitest';
import { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';
import { createBBTRulerTicks } from './bbt-ruler-ticks';

function createMapper(pixelsPerQuarterNote: number) {
  return new TimelineCoordinateMapper({
    tempoBpm: 120,
    beatsPerBar: 4,
    beatUnit: 4,
    pixelsPerQuarterNote,
  });
}

describe('BBT ruler tick 계산', () => {
  it('확대 상태에서는 박자와 반 박자 tick을 표시한다', () => {
    const ticks = createBBTRulerTicks({
      coordinateMapper: createMapper(48),
      endSeconds: 2,
    });

    expect(ticks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ bar: 1, beat: 1, level: 'bar', label: '1' }),
        expect.objectContaining({ bar: 1, beat: 1, tick: 960, level: 'subdivision' }),
        expect.objectContaining({ bar: 1, beat: 2, level: 'beat' }),
      ])
    );
  });

  it('축소 상태에서는 마디 tick만 남기고 label 간격을 확보한다', () => {
    const ticks = createBBTRulerTicks({
      coordinateMapper: createMapper(4),
      endSeconds: 8,
    });

    expect(ticks.every(tick => tick.level === 'bar')).toBe(true);
    expect(ticks.find(tick => tick.bar === 1)?.label).toBe('1');
    expect(ticks.find(tick => tick.bar === 2)?.label).toBeNull();
    expect(ticks.find(tick => tick.bar === 5)?.label).toBe('5');
  });

  it('표시 끝을 넘는 tick을 만들지 않는다', () => {
    const ticks = createBBTRulerTicks({
      coordinateMapper: createMapper(48),
      endSeconds: 1,
    });

    expect(Math.max(...ticks.map(tick => tick.seconds))).toBeLessThanOrEqual(1);
  });
});
