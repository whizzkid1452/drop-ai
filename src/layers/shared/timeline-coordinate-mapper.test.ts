import { describe, expect, it } from 'vitest';
import { TICKS_PER_BEAT, TimelineCoordinateMapper } from './timeline-coordinate-mapper';

describe('TimelineCoordinateMapper', () => {
  it('120 BPM 4/4의 초 위치를 BBT로 변환한다', () => {
    const mapper = new TimelineCoordinateMapper({ tempoBpm: 120, beatsPerBar: 4, beatUnit: 4 });

    expect(mapper.secondsToBBT(0)).toEqual({ bar: 1, beat: 1, tick: 0 });
    expect(mapper.secondsToBBT(0.5)).toEqual({ bar: 1, beat: 2, tick: 0 });
    expect(mapper.secondsToBBT(2)).toEqual({ bar: 2, beat: 1, tick: 0 });
  });

  it('BBT 위치를 초로 역변환한다', () => {
    const mapper = new TimelineCoordinateMapper({ tempoBpm: 90, beatsPerBar: 3, beatUnit: 4 });

    expect(mapper.bbtToSeconds({ bar: 2, beat: 1, tick: 0 })).toBeCloseTo(2);
    expect(mapper.bbtToSeconds({ bar: 1, beat: 2, tick: TICKS_PER_BEAT / 2 })).toBeCloseTo(1);
  });

  it('박자표 분모를 반영해 6/8의 마디와 박자를 계산한다', () => {
    const mapper = new TimelineCoordinateMapper({ tempoBpm: 120, beatsPerBar: 6, beatUnit: 8 });

    expect(mapper.secondsToBBT(0.25)).toEqual({ bar: 1, beat: 2, tick: 0 });
    expect(mapper.secondsToBBT(1.5)).toEqual({ bar: 2, beat: 1, tick: 0 });
  });

  it('동일한 mapper에서 초와 pixel을 왕복 변환한다', () => {
    const mapper = new TimelineCoordinateMapper({
      tempoBpm: 120,
      beatsPerBar: 4,
      beatUnit: 4,
      pixelsPerQuarterNote: 48,
    });

    expect(mapper.secondsToPixels(1.25)).toBe(120);
    expect(mapper.pixelsToSeconds(120)).toBeCloseTo(1.25);
  });

  it('구간 너비는 시작과 끝 pixel의 차이로 계산한다', () => {
    const mapper = new TimelineCoordinateMapper({
      tempoBpm: 120,
      beatsPerBar: 4,
      beatUnit: 4,
      pixelsPerQuarterNote: 50,
    });

    expect(mapper.durationToPixels({ startSeconds: 2, durationSeconds: 1.5 })).toBe(150);
  });

  it.each([
    { tempoBpm: 0, beatsPerBar: 4, beatUnit: 4 },
    { tempoBpm: Number.NaN, beatsPerBar: 4, beatUnit: 4 },
    { tempoBpm: 120, beatsPerBar: 0, beatUnit: 4 },
    { tempoBpm: 120, beatsPerBar: 4, beatUnit: 3 },
  ])('유효하지 않은 설정을 거부한다: %o', options => {
    expect(() => new TimelineCoordinateMapper(options)).toThrow();
  });

  it('유효하지 않은 BBT 위치를 거부한다', () => {
    const mapper = new TimelineCoordinateMapper({ tempoBpm: 120, beatsPerBar: 4, beatUnit: 4 });

    expect(() => mapper.bbtToSeconds({ bar: 0, beat: 1, tick: 0 })).toThrow();
    expect(() => mapper.bbtToSeconds({ bar: 1, beat: 5, tick: 0 })).toThrow();
    expect(() => mapper.bbtToSeconds({ bar: 1, beat: 1, tick: TICKS_PER_BEAT })).toThrow();
  });
});
