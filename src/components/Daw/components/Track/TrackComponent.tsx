import type { Track } from '@/types/track';
import type WaveSurfer from 'wavesurfer.js';
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
      {mediaElement ? (
        <TrackVolumeController
          volume={track.volume ?? 1}
          onVolumeChange={onVolumeChange}
        />
      ) : null}
      {mediaElement ? (
        <TrackPanController pan={track.pan ?? 0} onPanChange={onPanChange} />
      ) : null}
    </>
  );
};

/** @description wavesurfer의 scrollbar를 가리기 위함. shadowRoot 내부라 억지로 style 주입 */

