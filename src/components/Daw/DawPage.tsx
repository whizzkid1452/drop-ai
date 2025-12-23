import { useMemo } from 'react';
import { AudioFileDrop } from '../common/FileDrop/AudioFileDrop';
import { DawHeader } from './components/DawHeader';
import { TrackList } from './components/TrackList';
import * as styles from './DawPage.css';
import { useTrackStore } from '@/stores/useTrackStore';

export function DawPage() {
  const tracks = useTrackStore(state => state.tracks);
  const hasTracks = useMemo(() => tracks.size > 0, [tracks.size]);

  return (
    <div className={styles.container}>
      <div className={styles.backgroundGrid} />
      <div className={styles.glowEffect} />
      <div className={styles.waveAnimation} />

      {hasTracks ? (
        <>
          <DawHeader trackCount={tracks.size} />
          <TrackList
            onRemove={() => {
              // @todo: 추가 예정
            }}
            onVolumeChange={() => {
              // @todo: 추가 예정
            }}
          />
        </>
      ) : (
        <div className={styles.modalOverlay}>
          <div>
            <AudioFileDrop
              onAudioFileDrop={() => {
                // @todo: 추가시 트랙에 자동 추가 기능 추가 예정
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
