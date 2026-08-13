import type WaveSurfer from 'wavesurfer.js';
import { memo, useState } from 'react';
import type { TrackToggleResult } from '@/layers/apps/web/hooks/track-mute-solo-commands';
import type { TrackState } from '@/layers/session/session';
import { useTrackActions } from '@/layers/apps/web/hooks/useTrackActions';
import { TrackNameControl } from './components/TrackNameControl';
import { RegionComponent } from './RegionComponent';
import * as styles from './Track.css.ts';
import type { WaveformRenderData } from '@/layers/apps/web/components/Daw/components/TrackList/waveform-render-cache';
import type { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';
import type { TimelineGridSettings } from '../../timeline-grid';
import { AudioLevelMeter } from '../AudioLevelMeter/AudioLevelMeter';
import { TrackInputMonitoringControl } from '../LiveInputControls/TrackInputMonitoringControl';
import { TrackRecordArmControl } from './components/TrackRecordArmControl';

export interface RegionWaveSurferReadyEvent {
  trackId: string;
  regionId: string;
  sourceId: string;
  waveSurfer: WaveSurfer;
}

export const TrackComponent = memo(function TrackComponent({
  isSelected,
  track,
  coordinateMapper,
  gridSettings,
  onReady,
  onMuteChange,
  onSelect,
  onSoloChange,
  waveformRenderCache,
}: {
  isSelected: boolean;
  track: TrackState;
  coordinateMapper: TimelineCoordinateMapper;
  gridSettings: TimelineGridSettings;
  onReady: (event: RegionWaveSurferReadyEvent) => void;
  onMuteChange: (muted: boolean) => Promise<TrackToggleResult>;
  onSelect: () => void;
  onSoloChange: (soloed: boolean) => Promise<TrackToggleResult>;
  waveformRenderCache: ReadonlyMap<string, WaveformRenderData>;
}) {
  const { moveRegion, removeRegion } = useTrackActions();
  const [isMutePending, setIsMutePending] = useState(false);
  const [isSoloPending, setIsSoloPending] = useState(false);

  const handleRemoveRegion = (regionId: string) => {
    void removeRegion({ trackId: track.id, regionId });
  };

  const handleMoveRegion = async (regionId: string, newStartTime: number) => {
    await moveRegion({ trackId: track.id, regionId, newStartTime });
  };

  const handleMuteChange = async () => {
    if (isMutePending) {
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
    if (isSoloPending) {
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
    <article
      className={styles.trackRow}
      aria-label={`Track ${track.name}`}
      data-selected={isSelected}
      onFocus={onSelect}
      onMouseDownCapture={onSelect}
      tabIndex={0}
    >
      <div className={`${styles.trackHeader} ${isSelected ? styles.trackHeaderSelected : ''}`}>
        <TrackNameControl trackId={track.id} name={track.name} />
        <div className={styles.actionControls}>
          <TrackRecordArmControl trackId={track.id} trackName={track.name} />
          <button
            type="button"
            className={`${styles.trackActionButton} ${track.isMuted ? styles.muteButtonActive : ''}`}
            aria-label="Track Mute"
            aria-pressed={track.isMuted}
            disabled={isMutePending}
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
            disabled={isSoloPending}
            onClick={() => void handleSoloChange()}
            title="Solo"
          >
            S
          </button>
          <TrackInputMonitoringControl trackId={track.id} trackName={track.name} />
        </div>
        <AudioLevelMeter label="Track" target={{ kind: 'track', trackId: track.id }} />
      </div>
      <div className={styles.trackTimeline} aria-label={`${track.name} timeline`}>
        {track.regions.map(region => (
          <RegionComponent
            key={region.id}
            region={region}
            coordinateMapper={coordinateMapper}
            gridSettings={gridSettings}
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
