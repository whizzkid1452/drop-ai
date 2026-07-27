import { describe, expect, it } from 'vitest';
import { calculateLoopDurationSeconds, calculateNextLoopBoundarySeconds, isLoopLengthBars } from './loop-time';

describe('루프 음악 시간', () => {
  it('120 BPM의 4마디 길이를 초로 계산한다', () => {
    expect(calculateLoopDurationSeconds({ lengthBars: 4, tempoBpm: 120 })).toBe(8);
  });

  it('현재 위치 이후의 첫 마디 경계를 계산한다', () => {
    expect(
      calculateNextLoopBoundarySeconds({
        currentTimeSeconds: 2.1,
        originTimeSeconds: 0,
        quantizationBars: 1,
        tempoBpm: 120,
      })
    ).toBe(4);
  });

  it('현재 위치가 경계와 일치하면 현재 경계를 반환한다', () => {
    expect(
      calculateNextLoopBoundarySeconds({
        currentTimeSeconds: 4,
        originTimeSeconds: 0,
        quantizationBars: 1,
        tempoBpm: 120,
      })
    ).toBe(4);
  });

  it('유효하지 않은 시간 입력은 계산하지 않는다', () => {
    expect(calculateLoopDurationSeconds({ lengthBars: 4, tempoBpm: Number.POSITIVE_INFINITY })).toBeNull();
    expect(
      calculateNextLoopBoundarySeconds({
        currentTimeSeconds: -1,
        originTimeSeconds: 0,
        quantizationBars: 1,
        tempoBpm: 120,
      })
    ).toBeNull();
  });

  it('지원하는 마디 길이만 식별한다', () => {
    expect([1, 2, 4, 8].every(isLoopLengthBars)).toBe(true);
    expect(isLoopLengthBars(3)).toBe(false);
  });
});
