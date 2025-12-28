import WavesurferPlayer from '@wavesurfer/react';
import { TrackVolumeController } from './components/TrackVolumeController';
import { TrackPanController } from './components/TrackPanController';
import type WaveSurfer from 'wavesurfer.js';
import type { Track } from '@/types/track';

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
        onClick={_wavesurfer => {
          // Seek Logic needed later
        }}
        dragToSeek={true}
        minPxPerSec={3}
        width={(track.regions[0].audioFile.duration ?? 1) * 3.1}
      />
      {/* Volume Controller: Updates Store AND AudioEngine */}
      {mediaElement ? (
        <TrackVolumeController
          initialVolume={track.volume ?? 1}
          onVolumeChange={onVolumeChange}
        />
      ) : null}
      {mediaElement ? (
        <TrackPanController
          initialPan={track.pan ?? 0}
          onPanChange={onPanChange}
        />
      ) : null}
    </>
  );
};
