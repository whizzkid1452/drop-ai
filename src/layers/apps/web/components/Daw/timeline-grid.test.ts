import { describe, expect, it } from 'vitest';
import { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';
import { getTimelineGridStepQuarterNotes, snapTimelineSeconds } from './timeline-grid';

const coordinateMapper = new TimelineCoordinateMapper({
  tempoBpm: 120,
  beatsPerBar: 4,
  beatUnit: 4,
  pixelsPerQuarterNote: 100,
});

describe('Timeline grid', () => {
  it.each([
    ['bar', 4],
    ['beat', 1],
    ['halfBeat', 0.5],
    ['quarterBeat', 0.25],
    ['eighthBeat', 0.125],
    ['sixteenthBeat', 0.0625],
  ] as const)('%s 간격을 quarter note로 계산한다', (division, expected) => {
    expect(getTimelineGridStepQuarterNotes({ coordinateMapper, division })).toBe(expected);
  });

  it('Grid 모드는 가장 가까운 grid 선으로 이동한다', () => {
    expect(
      snapTimelineSeconds({
        coordinateMapper,
        division: 'beat',
        mode: 'grid',
        seconds: 0.31,
      })
    ).toBe(0.5);
  });

  it('Magnetic 모드는 threshold 안에서만 이동한다', () => {
    expect(
      snapTimelineSeconds({
        coordinateMapper,
        division: 'beat',
        magneticThresholdPixels: 8,
        mode: 'magnetic',
        seconds: 0.47,
      })
    ).toBe(0.5);
    expect(
      snapTimelineSeconds({
        coordinateMapper,
        division: 'beat',
        magneticThresholdPixels: 8,
        mode: 'magnetic',
        seconds: 0.4,
      })
    ).toBe(0.4);
  });

  it('Off 모드는 음수가 아닌 원래 위치를 유지한다', () => {
    expect(
      snapTimelineSeconds({
        coordinateMapper,
        division: 'beat',
        mode: 'off',
        seconds: -1,
      })
    ).toBe(0);
  });
});
