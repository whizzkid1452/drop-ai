import type WaveSurfer from 'wavesurfer.js';
import { memo, useState } from 'react';
import { useSession } from '@/layers/apps/web/context/layer-hooks';
import type { TrackToggleResult } from '@/layers/apps/web/hooks/track-mute-solo-commands';
import type { TrackRemovalResult } from '@/layers/apps/web/hooks/track-action-commands';
import type { TrackState } from '@/layers/session/session';
import { useTrackActions } from '@/layers/apps/web/hooks/useTrackActions';
import { resolveSplitRegionId } from '@/layers/apps/web/hooks/resolve-split-region-id';
import { TrackPanController } from './components/TrackPanController';
import { TrackNameControl } from './components/TrackNameControl';
import { TrackPluginControls } from './components/TrackPluginControls';
import { TrackRegionImportControl } from './components/TrackRegionImportControl';
import { TrackVolumeController } from './components/TrackVolumeController';
import { LoopSlotControls } from './components/LoopSlotControls';
import { RegionComponent } from './RegionComponent';
import * as styles from './Track.css.ts';
import type { WaveformRenderData } from '@/layers/apps/web/components/Daw/components/TrackList/waveform-render-cache';

export interface RegionWaveSurferReadyEvent {
  trackId: string;
  regionId: string;
  sourceId: string;
  waveSurfer: WaveSurfer;
}

export const TrackComponent = memo(function TrackComponent({
  mediaElement,
  track,
  pixelsPerSecond,
  onReady,
  onVolumeChange,
  onPanChange,
  onMuteChange,
  onSoloChange,
  onRemoveTrack,
  waveformRenderCache,
}: {
  mediaElement: HTMLMediaElement | null;
  track: TrackState;
  pixelsPerSecond: number;
  onReady: (event: RegionWaveSurferReadyEvent) => void;
  onVolumeChange: (trackId: string, volume: number) => void;
  onPanChange: (trackId: string, pan: number) => void;
  onMuteChange: (muted: boolean) => Promise<TrackToggleResult>;
  onSoloChange: (soloed: boolean) => Promise<TrackToggleResult>;
  onRemoveTrack: () => Promise<TrackRemovalResult>;
  waveformRenderCache: ReadonlyMap<string, WaveformRenderData>;
}) {
  const { moveRegion, removeRegion, splitRegion } = useTrackActions();
  const [isMutePending, setIsMutePending] = useState(false);
  const [isSoloPending, setIsSoloPending] = useState(false);
  const [isRemovingTrack, setIsRemovingTrack] = useState(false);
  const [isImportingRegion, setIsImportingRegion] = useState(false);
  const currentTime = useSession(state => state.currentTime);
  const splitRegionId = resolveSplitRegionId({ regions: track.regions, splitTime: currentTime });

  const handleSplit = () => {
    if (!splitRegionId) {
      return;
    }

    void splitRegion({ trackId: track.id, regionId: splitRegionId, splitTime: currentTime }).catch(error => {
      console.error('[TrackComponent] Region split failed:', error);
    });
  };

  const handleRemoveRegion = (regionId: string) => {
    void removeRegion({ trackId: track.id, regionId });
  };

  const handleMoveRegion = async (regionId: string, newStartTime: number) => {
    await moveRegion({ trackId: track.id, regionId, newStartTime });
  };

  const handleRemoveTrack = async () => {
    if (isRemovingTrack || isImportingRegion) {
      return;
    }

    setIsRemovingTrack(true);
    try {
      await onRemoveTrack();
    } finally {
      setIsRemovingTrack(false);
    }
  };

  const handleMuteChange = async () => {
    if (isMutePending || isRemovingTrack || isImportingRegion) {
      return;
    }

    setIsMutePending(true);
    try {
      await onMuteChange(!track.isMuted);
    } finally {
      setIsMutePending(false);
    }
  };

  const handleSoloChange = async () => {
    if (isSoloPending || isRemovingTrack || isImportingRegion) {
      return;
    }

    setIsSoloPending(true);
    try {
      await onSoloChange(!track.isSoloed);
    } finally {
      setIsSoloPending(false);
    }
  };

  return (
    <article className={styles.trackRow} aria-label={`Track ${track.name}`}>
      <div className={styles.trackHeader}>
        <TrackNameControl trackId={track.id} name={track.name} />
        <div className={styles.actionControls}>
          <button
            type="button"
            className={`${styles.trackActionButton} ${track.isMuted ? styles.muteButtonActive : ''}`}
            aria-label="Track Mute"
            aria-pressed={track.isMuted}
            disabled={isMutePending || isRemovingTrack || isImportingRegion}
            onClick={() => void handleMuteChange()}
            title="Mute"
          >
            M
          </button>
          <button
            type="button"
            className={`${styles.trackActionButton} ${track.isSoloed ? styles.soloButtonActive : ''}`}
            aria-label="Track Solo"
            aria-pressed={track.isSoloed}
            disabled={isSoloPending || isRemovingTrack || isImportingRegion}
            onClick={() => void handleSoloChange()}
            title="Solo"
          >
            S
          </button>
          {mediaElement ? (
            <button
              type="button"
              className={styles.trackActionButton}
              disabled={!splitRegionId}
              onClick={handleSplit}
              title="Split region at playhead"
            >
              SPLIT
            </button>
          ) : null}
          <TrackRegionImportControl
            trackId={track.id}
            disabled={isRemovingTrack}
            onPendingChange={setIsImportingRegion}
          />
          <button
            type="button"
            className={`${styles.trackActionButton} ${styles.dangerButton}`}
            aria-label="Track 삭제"
            aria-busy={isRemovingTrack}
            disabled={isRemovingTrack || isImportingRegion}
            onClick={() => void handleRemoveTrack()}
            title="Delete track"
          >
            {isRemovingTrack ? '…' : '×'}
          </button>
        </div>
        {mediaElement ? (
          <div className={styles.mixControls}>
            <TrackVolumeController volume={track.volume ?? 1} onVolumeChange={val => onVolumeChange(track.id, val)} />
            <TrackPanController pan={track.pan ?? 0} onPanChange={val => onPanChange(track.id, val)} />
          </div>
        ) : null}
        <TrackPluginControls trackId={track.id} pluginInstances={track.pluginInstances} />
        {(track.loopSlots?.length ?? 0) > 0 ? (
          <LoopSlotControls loopSlots={track.loopSlots ?? []} trackId={track.id} />
        ) : null}
      </div>
      <div className={styles.trackTimeline} aria-label={`${track.name} timeline`}>
        {track.regions.map(region => (
          <RegionComponent
            key={region.id}
            region={region}
            pixelsPerSecond={pixelsPerSecond}
            onReady={waveSurfer =>
              onReady({
                trackId: track.id,
                regionId: region.id,
                sourceId: region.sourceId,
                waveSurfer,
              })
            }
            onMove={newStartTime => handleMoveRegion(region.id, newStartTime)}
            onRemove={() => handleRemoveRegion(region.id)}
            waveformRenderData={waveformRenderCache.get(region.sourceId)}
          />
        ))}
      </div>
    </article>
  );
});
