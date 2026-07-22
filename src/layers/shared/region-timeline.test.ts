import { describe, expect, it } from 'vitest';
import { calculateFiniteRegionEndTime, isRegionEndTimeConsistent } from './region-timeline';

describe('Region timeline', () => {
  it('유한한 비음수 시작과 길이로 끝 시각을 계산한다', () => {
    expect(calculateFiniteRegionEndTime({ startTime: 2, duration: 3 })).toBe(5);
    expect(calculateFiniteRegionEndTime({ startTime: 2, duration: 0 })).toBe(2);
  });

  it('입력이나 합산 결과가 유한한 비음수가 아니면 계산을 거부한다', () => {
    expect(calculateFiniteRegionEndTime({ startTime: -1, duration: 1 })).toBeNull();
    expect(calculateFiniteRegionEndTime({ startTime: 0, duration: Number.NaN })).toBeNull();
    expect(calculateFiniteRegionEndTime({ startTime: Number.POSITIVE_INFINITY, duration: 1 })).toBeNull();
    expect(calculateFiniteRegionEndTime({ startTime: Number.MAX_VALUE, duration: Number.MAX_VALUE })).toBeNull();
  });

  it('Number.MAX_VALUE까지의 유한한 경계 합은 허용한다', () => {
    expect(calculateFiniteRegionEndTime({ startTime: Number.MAX_VALUE / 2, duration: Number.MAX_VALUE / 2 })).toBe(
      Number.MAX_VALUE
    );
  });

  it('절대 오차 1e-9초와 숫자 크기 비례 오차 안의 끝 시각을 같은 값으로 본다', () => {
    expect(isRegionEndTimeConsistent({ startTime: 0.1, duration: 0.2, endTime: 0.3 })).toBe(true);
    expect(
      isRegionEndTimeConsistent({
        startTime: 5_278_453.819016906,
        duration: 15_265_389.086999921 - 5_278_453.819016906,
        endTime: 15_265_389.086999921,
      })
    ).toBe(true);
  });

  it('허용 오차를 넘거나 유한하지 않은 끝 시각은 다른 값으로 본다', () => {
    expect(isRegionEndTimeConsistent({ startTime: 2, duration: 3, endTime: 5.000000002 })).toBe(false);
    expect(isRegionEndTimeConsistent({ startTime: 2, duration: 3, endTime: Number.POSITIVE_INFINITY })).toBe(false);
  });
});
