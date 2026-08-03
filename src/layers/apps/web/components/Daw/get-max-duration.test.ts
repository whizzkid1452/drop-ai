import { describe, expect, it } from 'vitest';
import type { RegionState, TrackState } from '@/layers/session/session';
import { getMaxDuration } from './get-max-duration';

function createRegion(id: string, startTime: number, duration: number): RegionState {
  return {
    id,
    sourceId: `source-${id}`,
    startTime,
    endTime: startTime + duration,
    sourceStartTime: 0,
    duration,
    status: [],
  };
}

function createTrack(id: string, regions: RegionState[]): TrackState {
  return {
    id,
    name: id,
    volume: 1,
    pan: 0,
    isMuted: false,
    isSoloed: false,
    status: [],
    pluginInstances: [],
    regions,
  };
}

describe('getMaxDuration', () => {
  it('Session Region의 시작 시각과 길이로 가장 늦은 끝 시각을 계산한다', () => {
    const tracks = [
      createTrack('track-1', [createRegion('region-1', 2, 3), createRegion('region-2', 12, 2)]),
      createTrack('track-2', [createRegion('region-3', 7, 4)]),
      createTrack('track-3', []),
    ];

    expect(getMaxDuration(tracks)).toBe(14);
  });

  it('Track이 없으면 0을 반환한다', () => {
    expect(getMaxDuration([])).toBe(0);
  });
});
