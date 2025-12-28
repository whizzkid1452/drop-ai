import { AudioEngine } from '@/logics/audio/audioEngine';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import { useTrackStore } from '@/stores/useTrackStore';
import { AudioCommandType, type AudioCommand } from '@/types/audioEngine';
import WavesurferPlayer from '@wavesurfer/react';
import { useMemo, useState } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import { useShallow } from 'zustand/react/shallow';
import { TrackVolumeController } from './Track/components/TrackVolumeController';
import * as styles from './TrackList.css';
import { TrackPanController } from './Track/components/TrackPanController';

export function TrackList() {
  const { tracks, updateTrack } = useTrackStore(
    useShallow(state => ({
      tracks: state.tracks,
      updateTrack: state.updateTrack,
    }))
  );
  const trackArray = useMemo(() => Array.from(tracks.values()), [tracks]);

  const [wavesurferInstances, setWavesurferInstances] = useState<
    Map<string, WaveSurfer>
  >(new Map());

  const { setIsPlaying, setCurrentTime } = usePlaybackStore();

  const handleAudioCommand = (command: AudioCommand) => {
    AudioEngine.getInstance().execute({
      command,
      callback: ({ command: cmd }) => {
        // Update Store based on command type
        switch (cmd.type) {
          case AudioCommandType.PLAY:
            setIsPlaying(true);
            break;
          case AudioCommandType.PAUSE:
            setIsPlaying(false);
            break;
          case AudioCommandType.STOP:
            setIsPlaying(false);
            setCurrentTime(0);
            break;
          case AudioCommandType.SET_TRACK_VOLUME:
            updateTrack({
              trackId: cmd.trackId,
              updater: t => ({ ...t, volume: cmd.volume }),
            });
            break;
          case AudioCommandType.SET_TRACK_PAN:
            updateTrack({
              trackId: cmd.trackId,
              updater: t => ({ ...t, pan: cmd.pan }),
            });
            break;
        }
      },
    });
  };

  // Note: Manual AudioEngine initialization is now handled by useAudioSync

  const handlePlayAll = () => {
    handleAudioCommand({ type: AudioCommandType.PLAY });

    // Visualize Sync (Optional: Start wavesurfer cursors)
    wavesurferInstances.forEach(ws => ws.play());
  };

  const handlePauseAll = () => {
    handleAudioCommand({ type: AudioCommandType.PAUSE });

    // Visualize Sync
    wavesurferInstances.forEach(ws => ws.pause());
  };

  return (
    <div className={styles.trackList}>
      {/* @todo: 추후 디자인 수정 예정 */}
      <button onClick={handlePlayAll}>Play All</button>
      <button onClick={handlePauseAll}>Pause All</button>
      <div className={styles.tracksContainer}>
        {trackArray.map(track => {
          const thisWs = wavesurferInstances.get(track.id);
          const thisMedia = thisWs?.getMediaElement();

          return (
            <>
              <WavesurferPlayer
                key={track.id}
                url={track.regions[0].audioFile.url}
                onReady={ws => {
                  // trackStore에 wavesurfer 인스턴스 저장
                  setWavesurferInstances(prev => {
                    const newMap = new Map(prev);
                    newMap.set(track.id, ws);
                    return newMap;
                  });
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
              {thisMedia ? (
                <TrackVolumeController
                  initialVolume={track.volume ?? 1}
                  onVolumeChange={vol => {
                    // AudioEngine update is handled via Command Gateway & Callback
                    handleAudioCommand({
                      type: 'SET_TRACK_VOLUME',
                      trackId: track.id,
                      volume: vol,
                    });
                  }}
                />
              ) : null}
              {thisMedia ? (
                <TrackPanController
                  initialPan={track.pan ?? 0}
                  onPanChange={pan => {
                    // AudioEngine update is handled via Command Gateway & Callback
                    handleAudioCommand({
                      type: 'SET_TRACK_PAN',
                      trackId: track.id,
                      pan: pan,
                    });
                  }}
                />
              ) : null}
            </>
          );
        })}
      </div>
    </div>
  );
}
