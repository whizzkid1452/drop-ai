import { describe, expect, it } from 'vitest';
import { resolveSplitRegionId } from './resolve-split-region-id';

const regions = [
  { id: 'region-1', startTime: 1, endTime: 5 },
  { id: 'region-2', startTime: 7, endTime: 9 },
];

describe('분할 대상 Region 선택', () => {
  it('현재 시각을 포함하는 Region이 하나면 ID를 반환한다', () => {
    expect(resolveSplitRegionId({ regions, splitTime: 3 })).toBe('region-1');
  });

  it('현재 시각을 포함하는 Region이 없으면 null을 반환한다', () => {
    expect(resolveSplitRegionId({ regions, splitTime: 6 })).toBeNull();
  });

  it('Region 경계 시각은 분할 대상으로 선택하지 않는다', () => {
    expect(resolveSplitRegionId({ regions, splitTime: 1 })).toBeNull();
    expect(resolveSplitRegionId({ regions, splitTime: 5 })).toBeNull();
  });

  it('겹친 Region이 둘 이상이면 임의의 ID를 선택하지 않는다', () => {
    const overlappingRegions = [
      { id: 'region-1', startTime: 0, endTime: 5 },
      { id: 'region-2', startTime: 2, endTime: 6 },
    ];

    expect(resolveSplitRegionId({ regions: overlappingRegions, splitTime: 3 })).toBeNull();
  });
});
