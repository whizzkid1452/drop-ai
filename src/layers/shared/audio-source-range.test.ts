import { describe, expect, it } from 'vitest';
import { calculateFiniteRegionSourceEndTime, isRegionSourceRangeWithinDuration } from './audio-source-range';

describe('Region Source range', () => {
  it('유한한 비음수 원본 시작과 Region 길이로 원본 끝 시각을 계산한다', () => {
    expect(calculateFiniteRegionSourceEndTime({ sourceStartTimeSeconds: 2, regionDurationSeconds: 3 })).toBe(5);
    expect(calculateFiniteRegionSourceEndTime({ sourceStartTimeSeconds: 2, regionDurationSeconds: 0 })).toBe(2);
  });

  it('입력이나 합산 결과가 유한한 비음수가 아니면 계산을 거부한다', () => {
    expect(calculateFiniteRegionSourceEndTime({ sourceStartTimeSeconds: -1, regionDurationSeconds: 1 })).toBeNull();
    expect(
      calculateFiniteRegionSourceEndTime({ sourceStartTimeSeconds: 0, regionDurationSeconds: Number.NaN })
    ).toBeNull();
    expect(
      calculateFiniteRegionSourceEndTime({
        sourceStartTimeSeconds: Number.POSITIVE_INFINITY,
        regionDurationSeconds: 1,
      })
    ).toBeNull();
    expect(
      calculateFiniteRegionSourceEndTime({
        sourceStartTimeSeconds: Number.MAX_VALUE,
        regionDurationSeconds: Number.MAX_VALUE,
      })
    ).toBeNull();
  });

  it('Number.MAX_VALUE까지의 유한한 경계 합은 허용한다', () => {
    expect(
      calculateFiniteRegionSourceEndTime({
        sourceStartTimeSeconds: Number.MAX_VALUE / 2,
        regionDurationSeconds: Number.MAX_VALUE / 2,
      })
    ).toBe(Number.MAX_VALUE);
  });

  it('정확한 Source 끝과 숫자 크기에 비례한 허용 오차 범위를 허용한다', () => {
    expect(
      isRegionSourceRangeWithinDuration({
        sourceDurationSeconds: 10,
        sourceStartTimeSeconds: 2,
        regionDurationSeconds: 8,
      })
    ).toBe(true);
    expect(
      isRegionSourceRangeWithinDuration({
        sourceDurationSeconds: 0.3,
        sourceStartTimeSeconds: 0.1,
        regionDurationSeconds: 0.2,
      })
    ).toBe(true);

    const largeSourceDurationSeconds = 10_000_000;
    expect(
      isRegionSourceRangeWithinDuration({
        sourceDurationSeconds: largeSourceDurationSeconds,
        sourceStartTimeSeconds: largeSourceDurationSeconds,
        regionDurationSeconds: Number.EPSILON * largeSourceDurationSeconds * 2,
      })
    ).toBe(true);
  });

  it('Source 길이 초과와 계산 불가능한 범위를 거부한다', () => {
    expect(
      isRegionSourceRangeWithinDuration({
        sourceDurationSeconds: 10,
        sourceStartTimeSeconds: 8,
        regionDurationSeconds: 3,
      })
    ).toBe(false);
    expect(
      isRegionSourceRangeWithinDuration({
        sourceDurationSeconds: Number.MAX_VALUE,
        sourceStartTimeSeconds: Number.MAX_VALUE,
        regionDurationSeconds: Number.MAX_VALUE,
      })
    ).toBe(false);
  });
});
