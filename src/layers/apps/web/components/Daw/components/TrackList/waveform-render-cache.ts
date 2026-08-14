import type WaveSurfer from 'wavesurfer.js';
import { RUNTIME_DIAGNOSTIC_BUDGETS } from '@/layers/shared/types/runtime-diagnostics';

const MAX_RENDERED_CHANNELS = 2;

export interface WaveformRenderData {
  readonly duration: number;
  readonly objectUrl: string;
  readonly peaks: Array<Float32Array | number[]>;
}

export type WaveformRenderCache = Map<string, WaveformRenderData>;

interface GetCachedWaveformRenderDataOptions {
  cache: ReadonlyMap<string, WaveformRenderData>;
  sourceId: string;
  objectUrl: string;
}

interface StoreWaveformRenderDataOptions {
  cache: WaveformRenderCache;
  sourceId: string;
  objectUrl: string;
  waveSurfer: WaveSurfer;
}

interface PruneWaveformRenderCacheOptions {
  cache: WaveformRenderCache;
  activeSourceIds: ReadonlySet<string>;
}

export function getCachedWaveformRenderData({
  cache,
  sourceId,
  objectUrl,
}: GetCachedWaveformRenderDataOptions): WaveformRenderData | null {
  const cachedData = cache.get(sourceId);
  return cachedData?.objectUrl === objectUrl ? cachedData : null;
}

export function storeWaveformRenderData({
  cache,
  sourceId,
  objectUrl,
  waveSurfer,
}: StoreWaveformRenderDataOptions): void {
  if (getCachedWaveformRenderData({ cache, sourceId, objectUrl })) {
    return;
  }

  const decodedData = waveSurfer.getDecodedData();
  if (!decodedData || !Number.isFinite(decodedData.duration) || decodedData.duration <= 0) {
    return;
  }

  const renderedChannelCount = Math.min(decodedData.numberOfChannels, MAX_RENDERED_CHANNELS);
  if (renderedChannelCount === 0) {
    return;
  }

  const peaks = Array.from({ length: renderedChannelCount }, (_, channelIndex) =>
    decodedData.getChannelData(channelIndex)
  );
  cache.set(sourceId, {
    duration: decodedData.duration,
    objectUrl,
    peaks,
  });
}

export function pruneWaveformRenderCache({ cache, activeSourceIds }: PruneWaveformRenderCacheOptions): void {
  cache.forEach((_, sourceId) => {
    if (!activeSourceIds.has(sourceId)) {
      cache.delete(sourceId);
    }
  });
  while (cache.size > RUNTIME_DIAGNOSTIC_BUDGETS.maximumWaveformCacheEntries) {
    const oldestSourceId = cache.keys().next().value;
    if (oldestSourceId === undefined) {
      return;
    }
    cache.delete(oldestSourceId);
  }
}
