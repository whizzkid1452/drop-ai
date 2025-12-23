import { useTrackStore } from '@/stores/useTrackStore';
import WavesurferPlayer from '@wavesurfer/react';
import { useMemo, useRef } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import * as styles from './TrackList.css';

export function TrackList() {
  const tracks = useTrackStore(state => state.tracks);
  const trackArray = useMemo(() => Array.from(tracks.values()), [tracks]);

  const wavesurferInstances = useRef<Map<string, WaveSurfer>>(new Map());

  return (
    <div className={styles.trackList}>
      {/* @todo: 추후 디자인 수정 예정 */}
      <button
        onClick={() => {
          wavesurferInstances.current.forEach(ws => {
            ws.play();
          });
        }}
      >
        Play All
      </button>
      <button
        onClick={() => {
          wavesurferInstances.current.forEach(ws => {
            ws.pause();
          });
        }}
      >
        Pause All
      </button>
      <div className={styles.tracksContainer}>
        {trackArray.map(track => {
          return (
            <WavesurferPlayer
              key={track.id}
              url={track.regions[0].audioFile.url}
              onReady={ws => {
                // trackStore에 wavesurfer 인스턴스 저장
                wavesurferInstances.current.set(track.id, ws);
              }}
              onClick={wavesurfer => {
                wavesurferInstances.current.forEach(ws => {
                  if (ws === wavesurfer) {
                    return;
                  }
                  if (ws.getCurrentTime() === wavesurfer.getCurrentTime()) {
                    return;
                  }
                  ws.setTime(wavesurfer.getCurrentTime());
                });
              }}
              dragToSeek={true}
              minPxPerSec={3}
              width={(track.regions[0].audioFile.duration ?? 1) * 3.1}
            />
          );
        })}
      </div>
    </div>
  );
}
