import { describe, expect, it } from 'vitest';
import type WaveSurfer from 'wavesurfer.js';
import {
  createRegionWaveSurferKey,
  pruneWaveSurferInstances,
  registerWaveSurferInstance,
} from './prune-wave-surfer-instances';

const firstInstance = { name: 'first' } as unknown as WaveSurfer;
const secondInstance = { name: 'second' } as unknown as WaveSurfer;

describe('Region 기반 WaveSurfer 참조 관리', () => {
  it('같은 Track의 Region 두 개를 서로 다른 참조로 보관한다', () => {
    const firstKey = createRegionWaveSurferKey({ trackId: 'track-1', regionId: 'region-1' });
    const secondKey = createRegionWaveSurferKey({ trackId: 'track-1', regionId: 'region-2' });

    const withFirstRegion = registerWaveSurferInstance({
      instances: new Map(),
      trackId: 'track-1',
      regionId: 'region-1',
      instance: firstInstance,
    });
    const result = registerWaveSurferInstance({
      instances: withFirstRegion,
      trackId: 'track-1',
      regionId: 'region-2',
      instance: secondInstance,
    });

    expect(firstKey).not.toBe(secondKey);
    expect(result).toEqual(
      new Map([
        [firstKey, firstInstance],
        [secondKey, secondInstance],
      ])
    );
    expect(withFirstRegion.size).toBe(1);
  });

  it('Agent나 CLI가 제거한 Region의 참조도 삭제한다', () => {
    const firstKey = createRegionWaveSurferKey({ trackId: 'track-1', regionId: 'region-1' });
    const secondKey = createRegionWaveSurferKey({ trackId: 'track-2', regionId: 'region-2' });
    const instances = new Map<string, WaveSurfer>([
      [firstKey, firstInstance],
      [secondKey, secondInstance],
    ]);

    const result = pruneWaveSurferInstances({
      instances,
      activeRegionKeys: new Set([secondKey]),
    });

    expect(result).toEqual(new Map([[secondKey, secondInstance]]));
    expect(instances.size).toBe(2);
  });

  it('제거된 Region이 없으면 기존 Map을 재사용한다', () => {
    const firstKey = createRegionWaveSurferKey({ trackId: 'track-1', regionId: 'region-1' });
    const instances = new Map<string, WaveSurfer>([[firstKey, firstInstance]]);

    const result = pruneWaveSurferInstances({
      instances,
      activeRegionKeys: new Set([firstKey]),
    });

    expect(result).toBe(instances);
  });
});
