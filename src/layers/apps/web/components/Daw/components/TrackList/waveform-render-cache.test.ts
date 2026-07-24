import { describe, expect, it, vi } from 'vitest';
import type WaveSurfer from 'wavesurfer.js';
import {
  getCachedWaveformRenderData,
  pruneWaveformRenderCache,
  storeWaveformRenderData,
  type WaveformRenderCache,
} from './waveform-render-cache';

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
