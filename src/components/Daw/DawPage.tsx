import { useMemo } from 'react';
import { FileUpload } from './components/FileUpload/FileUpload';
import { DawHeader } from './components/DawHeader';
import { TrackList } from './components/TrackList';
import { useDawTracks } from './hooks/useDawTracks';
import * as styles from './DawPage.css';

export function DawPage() {
  const {
    tracks,
    pendingFile,
    removeTrack,
    handleFileUploaded,
    handleEdit,
    updateTrackVolume,
    updateTrackPan,
  } = useDawTracks();

  const hasTracks = useMemo(() => tracks.length > 0, [tracks.length]);
  const shouldShowUploader = useMemo(
    () => Boolean(pendingFile || !hasTracks),
    [hasTracks, pendingFile],
  );

  return (
    <div className={styles.container}>
      <div className={styles.backgroundGrid} />
      <div className={styles.glowEffect} />
      <div className={styles.waveAnimation} />

      {hasTracks && (
        <>
          <DawHeader trackCount={tracks.length} tracks={tracks} />
          <TrackList
            tracks={tracks}
            onRemove={removeTrack}
            onVolumeChange={updateTrackVolume}
            onPanChange={updateTrackPan}
          />
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