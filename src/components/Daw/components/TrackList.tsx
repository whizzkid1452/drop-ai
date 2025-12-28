import { useTrackStore } from '@/stores/useTrackStore';
import WavesurferPlayer from '@wavesurfer/react';
import { useMemo, useState } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import { TrackVolumeController } from './Track/components/TrackVolumeController';
import * as styles from './TrackList.css';

export function TrackList() {
  const tracks = useTrackStore(state => state.tracks);
  const trackArray = useMemo(() => Array.from(tracks.values()), [tracks]);

  const [wavesurferInstances, setWavesurferInstances] = useState<
    Map<string, WaveSurfer>
  >(new Map());

  return (
    <div className={styles.trackList}>
      {/* @todo: 추후 디자인 수정 예정 */}
      <button
        onClick={() => {
          wavesurferInstances.forEach(ws => {
            // ws.play();
            // ws는 visualize만 책임지기 때문에 WebAudioApi로 직접 재생합니다

            const mediaElement = ws.getMediaElement();
            mediaElement.play();
            const audioContext = new AudioContext();
            const source = audioContext.createMediaElementSource(mediaElement);
            const panner = audioContext.createStereoPanner();
            panner.pan.value = 1;
            source.connect(panner);
            panner.connect(audioContext.destination);
          });
        }}
      >
        Play All
      </button>
      <button
        onClick={() => {
          wavesurferInstances.forEach(ws => {
            // ws.pause();
            // ws는 visualize만 책임지기 때문에 WebAudioApi로 직접 재생합니다
            const mediaElement = ws.getMediaElement();
            mediaElement.pause();
          });
        }}
      >
        Pause All
      </button>
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
                }}
                onClick={wavesurfer => {
                  wavesurferInstances.forEach(ws => {
                    /** 동일한 트랙이면 패스 */
                    if (ws === wavesurfer) {
                      return;
                    }
                    /** 동일한 시간이면 패스(무한 루프 방지) */
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
              {thisMedia ? (
                <TrackVolumeController
                  initialVolume={thisMedia.volume}
                  onVolumeChange={vol => {
                    thisMedia.volume = vol;
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
