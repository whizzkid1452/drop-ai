import type WaveSurfer from 'wavesurfer.js';

interface PruneWaveSurferInstancesOptions {
  instances: Map<string, WaveSurfer>;
  activeTrackIds: ReadonlySet<string>;
}

export function pruneWaveSurferInstances({
  instances,
  activeTrackIds,
}: PruneWaveSurferInstancesOptions): Map<string, WaveSurfer> {
  const hasRemovedTrack = Array.from(instances.keys()).some(trackId => !activeTrackIds.has(trackId));
  if (!hasRemovedTrack) {
    return instances;
  }

  return new Map(Array.from(instances).filter(([trackId]) => activeTrackIds.has(trackId)));
}
