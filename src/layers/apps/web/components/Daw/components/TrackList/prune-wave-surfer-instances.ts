import type WaveSurfer from 'wavesurfer.js';

interface PruneWaveSurferInstancesOptions {
  instances: Map<string, WaveSurfer>;
  activeRegionKeys: ReadonlySet<string>;
}

interface RegionWaveSurferIdentity {
  trackId: string;
  regionId: string;
}

interface RegisterWaveSurferInstanceOptions extends RegionWaveSurferIdentity {
  instances: Map<string, WaveSurfer>;
  instance: WaveSurfer;
}

export function createRegionWaveSurferKey({ trackId, regionId }: RegionWaveSurferIdentity): string {
  return JSON.stringify([trackId, regionId]);
}

export function registerWaveSurferInstance({
  instances,
  trackId,
  regionId,
  instance,
}: RegisterWaveSurferInstanceOptions): Map<string, WaveSurfer> {
  const nextInstances = new Map(instances);
  nextInstances.set(createRegionWaveSurferKey({ trackId, regionId }), instance);
  return nextInstances;
}

export function pruneWaveSurferInstances({
  instances,
  activeRegionKeys,
}: PruneWaveSurferInstancesOptions): Map<string, WaveSurfer> {
  const hasRemovedRegion = Array.from(instances.keys()).some(regionKey => !activeRegionKeys.has(regionKey));
  if (!hasRemovedRegion) {
    return instances;
  }

  return new Map(Array.from(instances).filter(([regionKey]) => activeRegionKeys.has(regionKey)));
}
