import { useAudioEngineHandleWithUi } from '@/hooks/agent/useAudioEngineHandleWithUi';
import { useTrackStore } from '@/stores/useTrackStore';
import { useMemo, useState } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import { useShallow } from 'zustand/react/shallow';
import { TrackComponent } from './Track/TrackComponent';
import * as styles from './TrackList.css';
import { AudioCommandType } from '@/types/audioCommand.schema';

export function TrackList() {
  const tracks = useTrackStore(useShallow(state => state.tracks));
  const trackArray = useMemo(() => Array.from(tracks.values()), [tracks]);

  const [wavesurferInstances, setWavesurferInstances] = useState<
    Map<string, WaveSurfer>
  >(new Map());

  const { handleAudioCommand } = useAudioEngineHandleWithUi();
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
            <TrackComponent
              key={track.id}
              track={track}
              mediaElement={thisMedia ?? null}
              onReady={ws => {
                // trackStore에 wavesurfer 인스턴스 저장
                setWavesurferInstances(prev => {
                  const newMap = new Map(prev);
                  newMap.set(track.id, ws);
                  return newMap;
                });
              }}
              onVolumeChange={vol =>
                handleAudioCommand({
                  type: 'SET_TRACK_VOLUME',
                  trackId: track.id,
                  volume: vol,
                })
              }
              onPanChange={pan =>
                handleAudioCommand({
                  type: 'SET_TRACK_PAN',
                  trackId: track.id,
                  pan: pan,
                })
              }
            />
          );
        })}
      </div>
    </div>
  );
}
