import { useState, useCallback } from 'react';
import { Track } from './components/Track/Track';
import { ExportButton } from './components/ExportButton/ExportButton';
import { FileUpload } from './components/FileUpload/FileUpload';
import type { AudioFile } from './components/FileUpload/components/types';
import * as styles from './DawPage.css';

export function DawPage() {
  const [tracks, setTracks] = useState<AudioFile[]>([]);

  const addTrack = useCallback((file: AudioFile) => {
    setTracks((prev) => [...prev, file]);
  }, []);

  const removeTrack = useCallback((index: number) => {
    setTracks((prev) => {
      const newTracks = [...prev];
      // 추상화된 cleanup 메서드를 통해 리소스 정리
      newTracks[index]?.dispose?.();
      newTracks.splice(index, 1);
      return newTracks;
    });
  }, []);

  const handleFileUploaded = (file: AudioFile) => {
    addTrack(file);
  };

  return (
    <div className={styles.container}>
      <div className={styles.backgroundGrid} />
      <div className={styles.glowEffect} />
      <div className={styles.waveAnimation} />

      <div className={styles.heroSection}>
        <h1 className={styles.logo}>Drop.ai</h1>
        <div className={styles.accentLine} />
        <p className={styles.subtitle}>Browser-based audio editing tool</p>
      </div>

      <div className={styles.header}>
        <h1 className={styles.title}>트랙 목록</h1>
        {tracks.length > 0 && (
          <div className={styles.headerRight}>
            <span className={styles.trackCount}>{tracks.length}개 트랙</span>
            <ExportButton tracks={tracks} />
          </div>
        )}
      </div>

      <div className={styles.uploadSection}>
        <FileUpload onFileUploaded={handleFileUploaded} autoReset={true} />
      </div>

      {tracks.length > 0 && (
        <div className={styles.trackList}>
          {tracks.map((track, index) => (
            <Track
              key={`${track.name}-${index}`}
              track={track}
              index={index}
              onRemove={removeTrack}
            />
          ))}
        </div>
      )}
    </div>
  );
}