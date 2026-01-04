import type { Track } from '@/types/track';
import { PIXELS_PER_SECOND } from '@/constants/dawConstants';
import WavesurferPlayer from '@wavesurfer/react';
import type WaveSurfer from 'wavesurfer.js';
import { TrackPanController } from './components/TrackPanController';
import { TrackVolumeController } from './components/TrackVolumeController';

export const TrackComponent = ({
  mediaElement,
  track,
  onReady,
  onVolumeChange,
  onPanChange,
}: {
  mediaElement: HTMLMediaElement | null;
  track: Track;
  onReady: (ws: WaveSurfer) => void;
  onVolumeChange: (volume: number) => void;
  onPanChange: (pan: number) => void;
}) => {
  return (
    <>
      <WavesurferPlayer
        url={track.regions[0].audioFile.url}
        onReady={ws => {
          onReady(ws);
          // Mute the visualization audio element because AudioEngine handles the sound
          ws.setVolume(0);
        }}
        interact={false}
        cursorWidth={0} /** @note wavesurfer의 cursor를 가리기 위함 */
        minPxPerSec={PIXELS_PER_SECOND}
        width={(track.regions[0].audioFile.duration ?? 1) * PIXELS_PER_SECOND}
      />
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
