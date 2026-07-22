import type WaveSurfer from 'wavesurfer.js';
import { memo, useState } from 'react';
import { useSession } from '@/layers/apps/web/context/LayerContext';
import type { TrackToggleResult } from '@/layers/apps/web/hooks/track-mute-solo-commands';
import type { TrackRemovalResult } from '@/layers/apps/web/hooks/track-action-commands';
import type { TrackState } from '@/layers/session/session';
import { useTrackActions } from '@/layers/apps/web/hooks/useTrackActions';
import { resolveSplitRegionId } from '@/layers/apps/web/hooks/resolve-split-region-id';
import { TrackPanController } from './components/TrackPanController';
import { TrackVolumeController } from './components/TrackVolumeController';
import { RegionComponent } from './RegionComponent';

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
}: {
  mediaElement: HTMLMediaElement | null;
  track: TrackState;
  pixelsPerSecond: number;
  onReady: (trackId: string, ws: WaveSurfer) => void;
  onVolumeChange: (trackId: string, volume: number) => void;
  onPanChange: (trackId: string, pan: number) => void;
  onMuteChange: (muted: boolean) => Promise<TrackToggleResult>;
  onSoloChange: (soloed: boolean) => Promise<TrackToggleResult>;
  onRemoveTrack: () => Promise<TrackRemovalResult>;
}) {
  const { moveRegion, removeRegion, splitRegion } = useTrackActions();
  const [isMutePending, setIsMutePending] = useState(false);
  const [isSoloPending, setIsSoloPending] = useState(false);
  const [isRemovingTrack, setIsRemovingTrack] = useState(false);
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
    if (isRemovingTrack) {
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
    if (isMutePending || isRemovingTrack) {
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
    if (isSoloPending || isRemovingTrack) {
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
    <>
      <div style={{ position: 'relative', height: '128px', width: '100%' }}>
        {track.regions.map(region => (
          <RegionComponent
            key={region.id}
            region={region}
            pixelsPerSecond={pixelsPerSecond}
            onReady={ws => onReady(track.id, ws)}
            onMove={newStartTime => handleMoveRegion(region.id, newStartTime)}
            onRemove={() => handleRemoveRegion(region.id)}
          />
        ))}
      </div>
      {/* Volume Controller: Updates Store AND AudioEngine */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
        {mediaElement ? (
          <>
            <TrackVolumeController volume={track.volume ?? 1} onVolumeChange={val => onVolumeChange(track.id, val)} />
            <TrackPanController pan={track.pan ?? 0} onPanChange={val => onPanChange(track.id, val)} />
            <button
              disabled={!splitRegionId}
              onClick={handleSplit}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                backgroundColor: '#333',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: splitRegionId ? 'pointer' : 'not-allowed',
                opacity: splitRegionId ? 1 : 0.5,
              }}
            >
              Split
            </button>
          </>
        ) : null}
        <button
          type="button"
          aria-label="Track Mute"
          aria-pressed={track.isMuted}
          disabled={isMutePending || isRemovingTrack}
          onClick={() => void handleMuteChange()}
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            backgroundColor: track.isMuted ? '#8a3b3b' : '#333',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isMutePending || isRemovingTrack ? 'wait' : 'pointer',
            opacity: isMutePending || isRemovingTrack ? 0.5 : 1,
          }}
        >
          Mute
        </button>
        <button
          type="button"
          aria-label="Track Solo"
          aria-pressed={track.isSoloed}
          disabled={isSoloPending || isRemovingTrack}
          onClick={() => void handleSoloChange()}
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            backgroundColor: track.isSoloed ? '#8a6d1b' : '#333',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isSoloPending || isRemovingTrack ? 'wait' : 'pointer',
            opacity: isSoloPending || isRemovingTrack ? 0.5 : 1,
          }}
        >
          Solo
        </button>
        <button
          type="button"
          aria-label="Track 삭제"
          aria-busy={isRemovingTrack}
          disabled={isRemovingTrack}
          onClick={() => void handleRemoveTrack()}
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            backgroundColor: '#333',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isRemovingTrack ? 'wait' : 'pointer',
            opacity: isRemovingTrack ? 0.5 : 1,
          }}
        >
          {isRemovingTrack ? '삭제 중…' : 'Track 삭제'}
        </button>
      </div>
    </>
  );
});
