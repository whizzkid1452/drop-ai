import { useMemo } from 'react';
import { useAudioFileStore } from '@/stores/useAudioFileStore';
import { AudioFileDrop } from '../common/FileDrop/AudioFileDrop';
import { DawHeader } from './components/DawHeader';
import { TrackList } from './components/TrackList';
import * as styles from './DawPage.css';

export function DawPage() {
  const audioFiles = useAudioFileStore(state => state.audioFiles);
  const audios = useMemo(() => {
    return Array.from(audioFiles.values());
  }, [audioFiles]);

  // @todo: audio를 track 개념으로 변환 필요
  const hasTracks = useMemo(() => audios.length > 0, [audios.length]);

  return (
    <div className={styles.container}>
      <div className={styles.backgroundGrid} />
      <div className={styles.glowEffect} />
      <div className={styles.waveAnimation} />

      {hasTracks ? (
        <>
          <DawHeader trackCount={audios.length} tracks={audios} />
          <TrackList
            tracks={audios}
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
