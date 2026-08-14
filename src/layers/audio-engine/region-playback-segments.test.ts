import { describe, expect, it } from 'vitest';
import type { RegionData } from './i-audio-engine';
import { createAudibleRegionSegments } from './region-playback-segments';

function createRegion(overrides: Partial<RegionData> = {}): RegionData {
  return {
    duration: 10,
    fadeIn: { crossfadeId: null, curve: 'linear', durationSeconds: 1 },
    fadeOut: { crossfadeId: null, curve: 'linear', durationSeconds: 2 },
    gain: 1,
    id: 'region',
    isOpaque: false,
    layer: 0,
    sourceStartTime: 0,
    startTime: 0,
    url: 'source.wav',
    ...overrides,
  };
}

describe('createAudibleRegionSegments', () => {
  it('더 높은 opaque Region이 없으면 전체 Region을 그대로 재생한다', () => {
    const region = createRegion();

    expect(createAudibleRegionSegments({ region, regions: [region] })).toEqual([region]);
  });

  it('더 높은 opaque Region의 겹침을 빼고 내부 절단 경계에는 Fade를 만들지 않는다', () => {
    const region = createRegion();
    const cover = createRegion({
      duration: 2,
      id: 'cover',
      isOpaque: true,
      layer: 1,
      startTime: 3,
    });

    expect(createAudibleRegionSegments({ region, regions: [region, cover] })).toEqual([
      {
        ...region,
        duration: 3,
        fadeOut: { crossfadeId: null, curve: 'linear', durationSeconds: 0 },
      },
      {
        ...region,
        duration: 5,
        fadeIn: { crossfadeId: null, curve: 'linear', durationSeconds: 0 },
        sourceStartTime: 5,
        startTime: 5,
      },
    ]);
  });

  it('transparent Region과 같은 Layer의 opaque Region은 아래 Region을 가리지 않는다', () => {
    const region = createRegion();
    const transparent = createRegion({ id: 'transparent', layer: 2, startTime: 2 });
    const sameLayerOpaque = createRegion({ id: 'same-layer', isOpaque: true, startTime: 4 });

    expect(createAudibleRegionSegments({ region, regions: [region, transparent, sameLayerOpaque] })).toEqual([region]);
  });

  it('여러 opaque Region의 겹치는 가림 구간을 합쳐 중복 Segment를 만들지 않는다', () => {
    const region = createRegion();
    const firstCover = createRegion({ duration: 3, id: 'cover-1', isOpaque: true, layer: 1, startTime: 2 });
    const secondCover = createRegion({ duration: 3, id: 'cover-2', isOpaque: true, layer: 2, startTime: 4 });

    expect(createAudibleRegionSegments({ region, regions: [region, firstCover, secondCover] })).toEqual([
      {
        ...region,
        duration: 2,
        fadeOut: { crossfadeId: null, curve: 'linear', durationSeconds: 0 },
      },
      {
        ...region,
        duration: 3,
        fadeIn: { crossfadeId: null, curve: 'linear', durationSeconds: 0 },
        sourceStartTime: 7,
        startTime: 7,
      },
    ]);
  });
});
