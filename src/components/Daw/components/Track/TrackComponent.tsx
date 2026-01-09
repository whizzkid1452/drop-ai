import type { Track } from '@/types/track';
import type WaveSurfer from 'wavesurfer.js';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import { useTrackActions } from '../../hooks/useTrackActions';
import { TrackPanController } from './components/TrackPanController';
import { TrackVolumeController } from './components/TrackVolumeController';
import { RegionComponent } from './RegionComponent';

export const TrackComponent = ({
  mediaElement,
  track,
  pixelsPerSecond,
  onReady,
  onVolumeChange,
  onPanChange,
}: {
  mediaElement: HTMLMediaElement | null;
  track: Track;
  pixelsPerSecond: number;
  onReady: (ws: WaveSurfer) => void;
  onVolumeChange: (volume: number) => void;
  onPanChange: (pan: number) => void;
}) => {
  const { splitRegion } = useTrackActions();

  return (
    <>
      <div style={{ position: 'relative', height: '128px', width: '100%' }}>
        {track.regions.map(region => (
          <RegionComponent
            key={region.id}
            region={region}
            pixelsPerSecond={pixelsPerSecond}
            onReady={onReady}
          />
        ))}
      </div>
      {/* Volume Controller: Updates Store AND AudioEngine */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
        {mediaElement ? (
          <>
            <TrackVolumeController
              volume={track.volume ?? 1}
              onVolumeChange={onVolumeChange}
            />
            <TrackPanController pan={track.pan ?? 0} onPanChange={onPanChange} />
            <button
              onClick={() => {
                const currentTime = usePlaybackStore.getState().currentTime;
                splitRegion(track.id, currentTime);
              }}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                backgroundColor: '#333',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Split
            </button>
          </>
        ) : null}
      </div>
    </>
  );
};



