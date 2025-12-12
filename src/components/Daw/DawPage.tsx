import { useState, useCallback } from 'react';
import { Track } from './components/Track/Track';
import { ExportButton } from './components/ExportButton/ExportButton';
import { FileUpload } from './components/FileUpload/FileUpload';
import type { AudioFile } from './components/FileUpload/components/types';
import * as styles from './DawPage.css';

export function DawPage() {
  const [tracks, setTracks] = useState<AudioFile[]>([]);
  const [pendingFile, setPendingFile] = useState<AudioFile | null>(null);

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
    // 새로운 업로드가 들어오면 이전 미리보기 리소스를 정리
    pendingFile?.dispose?.();
    setPendingFile(file);
  };

  const handleEdit = useCallback(() => {
    if (!pendingFile) return;
    addTrack(pendingFile);
    setPendingFile(null);
  }, [addTrack, pendingFile]);

  return (
    <div className={styles.container}>
      <div className={styles.backgroundGrid} />
      <div className={styles.glowEffect} />
      <div className={styles.waveAnimation} />

      {tracks.length > 0 && (
        <>
          <div className={styles.header}>
            <h1 className={styles.title}>트랙 목록</h1>
            <div className={styles.headerRight}>
              <span className={styles.trackCount}>{tracks.length}개 트랙</span>
              <ExportButton tracks={tracks} />
            </div>
          </div>

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
        </>
      )}

      {(pendingFile || tracks.length === 0) && (
        <div className={styles.modalOverlay}>

            <div>
              <FileUpload
                onFileUploaded={handleFileUploaded}
                onEdit={handleEdit}
                autoReset={true}
              />
            </div>

        </div>
      )}
    </div>
  );
}