import { useState, useCallback, useEffect, useMemo } from 'react';
import { Track } from './components/Track/Track';
import { ExportButton } from './components/ExportButton/ExportButton';
import { FileUpload } from './components/FileUpload/FileUpload';
import type { AudioFile } from './components/FileUpload/components/types';
import * as styles from './DawPage.css';

export function DawPage() {
  const [tracks, setTracks] = useState<AudioFile[]>([]);
  const [pendingFile, setPendingFile] = useState<AudioFile | null>(null);

  const disposeFile = useCallback((file?: AudioFile | null) => {
    file?.dispose?.();
  }, []);

  const hasTracks = useMemo(() => tracks.length > 0, [tracks.length]);
  const shouldShowUploader = useMemo(
    () => Boolean(pendingFile || !hasTracks),
    [hasTracks, pendingFile],
  );

  const addTrack = useCallback((file: AudioFile) => {
    setTracks((prev) => [...prev, file]);
  }, []);

  const removeTrack = useCallback((index: number) => {
    setTracks((prev) => {
      const newTracks = [...prev];
      disposeFile(newTracks[index]);
      newTracks.splice(index, 1);
      return newTracks;
    });
  }, [disposeFile]);

  const handleFileUploaded = useCallback(
    (file: AudioFile) => {
      disposeFile(pendingFile);
      setPendingFile(file);
    },
    [disposeFile, pendingFile],
  );

  const handleEdit = useCallback(() => {
    if (!pendingFile) return;
    addTrack(pendingFile);
    setPendingFile(null);
  }, [addTrack, pendingFile]);

  useEffect(() => {
    return () => disposeFile(pendingFile);
  }, [disposeFile, pendingFile]);

  return (
    <div className={styles.container}>
      <div className={styles.backgroundGrid} />
      <div className={styles.glowEffect} />
      <div className={styles.waveAnimation} />

      {hasTracks && (
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

      {shouldShowUploader && (
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