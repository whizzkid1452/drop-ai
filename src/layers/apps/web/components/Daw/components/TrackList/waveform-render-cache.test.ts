import { describe, expect, it, vi } from 'vitest';
import type WaveSurfer from 'wavesurfer.js';
import {
  getCachedWaveformRenderData,
  pruneWaveformRenderCache,
  storeWaveformRenderData,
  type WaveformRenderCache,
} from './waveform-render-cache';
import { RUNTIME_DIAGNOSTIC_BUDGETS } from '@/layers/shared/types/runtime-diagnostics';

const sourceId = '41e673bf-5467-4d36-a716-2d80a76ac82f';

function createWaveSurfer(channelData: Float32Array[], duration: number): WaveSurfer {
  return {
    getDecodedData: vi.fn(() => ({
      duration,
      numberOfChannels: channelData.length,
      getChannelData: (channelIndex: number) => channelData[channelIndex],
    })),
  } as unknown as WaveSurfer;
}

describe('Waveform render cache', () => {
  it('stores decoded waveform channels by source ID', () => {
    const firstChannel = new Float32Array([0, 0.5, -0.5]);
    const secondChannel = new Float32Array([0, 0.25, -0.25]);
    const cache: WaveformRenderCache = new Map();

    storeWaveformRenderData({
      cache,
      sourceId,
      objectUrl: 'blob:source',
      waveSurfer: createWaveSurfer([firstChannel, secondChannel], 3),
    });

    expect(getCachedWaveformRenderData({ cache, sourceId, objectUrl: 'blob:source' })).toEqual({
      duration: 3,
      objectUrl: 'blob:source',
      peaks: [firstChannel, secondChannel],
    });
  });

  it('활성 Source가 많아도 waveform cache 예산을 넘지 않는다', () => {
    const entryCount = RUNTIME_DIAGNOSTIC_BUDGETS.maximumWaveformCacheEntries + 1;
    const cache: WaveformRenderCache = new Map(
      Array.from({ length: entryCount }, (_, index) => [
        `source-${index}`,
        { duration: 1, objectUrl: `blob:${index}`, peaks: [new Float32Array([0])] },
      ])
    );
    const activeSourceIds = new Set(cache.keys());

    pruneWaveformRenderCache({ cache, activeSourceIds });

    expect(cache.size).toBe(RUNTIME_DIAGNOSTIC_BUDGETS.maximumWaveformCacheEntries);
    expect(cache.has('source-0')).toBe(false);
  });

  it('does not return data when the object URL no longer identifies the same runtime source', () => {
    const cache: WaveformRenderCache = new Map([
      [
        sourceId,
        {
          duration: 3,
          objectUrl: 'blob:old-source',
          peaks: [new Float32Array([0, 0.5, -0.5])],
        },
      ],
    ]);

    expect(getCachedWaveformRenderData({ cache, sourceId, objectUrl: 'blob:new-source' })).toBeNull();
  });

  it('removes data for sources that are no longer used by a region', () => {
    const cache: WaveformRenderCache = new Map([
      [
        sourceId,
        {
          duration: 3,
          objectUrl: 'blob:source',
          peaks: [new Float32Array([0, 0.5, -0.5])],
        },
      ],
    ]);

    pruneWaveformRenderCache({ cache, activeSourceIds: new Set() });

    expect(cache.size).toBe(0);
  });
});
