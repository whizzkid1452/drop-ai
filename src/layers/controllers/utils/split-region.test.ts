import { describe, expect, it } from 'vitest';
import type { RegionState } from '../../session/session';
import { createDefaultRegionProcessingState } from '../../shared/types/region-processing';
import { calculateSplitRegions } from './split-region';

const region: RegionState = {
  ...createDefaultRegionProcessingState(),
  id: 'region-1',
  startTime: 2,
  endTime: 12,
  sourceStartTime: 4,
  duration: 10,
  status: [],
  sourceId: '11111111-1111-4111-8111-111111111111',
};

describe('calculateSplitRegions', () => {
  it('분할 위치를 기준으로 길이와 원본 시작 위치를 계산한다', () => {
    const ids = ['left-region', 'right-region'];
    const result = calculateSplitRegions({ region, splitTime: 5, createId: () => ids.shift() ?? '' });

    expect(result?.left).toMatchObject({
      id: 'left-region',
      startTime: 2,
      endTime: 5,
      sourceStartTime: 4,
      duration: 3,
    });
    expect(result?.right).toMatchObject({
      id: 'right-region',
      startTime: 5,
      endTime: 12,
      sourceStartTime: 7,
      duration: 7,
    });
  });

  it.each([2, 12])('Region 경계 %s에서는 분할하지 않는다', splitTime => {
    expect(calculateSplitRegions({ region, splitTime })).toBeNull();
  });

  it('sourceId 기반 Region을 분할하면 양쪽 Region에 같은 sourceId를 보존한다', () => {
    const ids = ['left-source-region', 'right-source-region'];
    const result = calculateSplitRegions({
      region,
      splitTime: 5,
      createId: () => ids.shift() ?? '',
    });

    expect(result?.left).toMatchObject({
      id: 'left-source-region',
      sourceId: region.sourceId,
    });
    expect(result?.right).toMatchObject({
      id: 'right-source-region',
      sourceId: region.sourceId,
    });
  });

  it('바깥쪽 Fade와 Region 처리값을 보존하고 분할 경계 Fade는 제거한다', () => {
    const processedRegion: RegionState = {
      ...region,
      fadeIn: { crossfadeId: null, curve: 'equalPower', durationSeconds: 2 },
      fadeOut: { crossfadeId: null, curve: 'linear', durationSeconds: 3 },
      gain: 1.5,
      isOpaque: true,
      layer: 4,
    };
    const ids = ['left-region', 'right-region'];
    const result = calculateSplitRegions({
      region: processedRegion,
      splitTime: 7,
      createId: () => ids.shift() ?? '',
    });

    expect(result?.left).toMatchObject({
      fadeIn: processedRegion.fadeIn,
      fadeOut: { crossfadeId: null, curve: 'linear', durationSeconds: 0 },
      gain: 1.5,
      isOpaque: true,
      layer: 4,
    });
    expect(result?.right).toMatchObject({
      fadeIn: { crossfadeId: null, curve: 'equalPower', durationSeconds: 0 },
      fadeOut: processedRegion.fadeOut,
      gain: 1.5,
      isOpaque: true,
      layer: 4,
    });
  });
});
