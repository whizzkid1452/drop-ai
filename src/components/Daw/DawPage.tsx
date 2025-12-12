import { useTracks } from '@/contexts/TrackContext';
import { Track } from './components/Track/Track';
import { ExportButton } from './components/ExportButton/ExportButton';
import { FileUpload } from './components/FileUpload/FileUpload';
import type { AudioFile } from './components/FileUpload/components/types';
import * as styles from './DawPage.css';

export function DawPage() {
  const { tracks, addTrack, removeTrack } = useTracks();

  const handleFileUploaded = (file: AudioFile) => {
    addTrack(file);
  };

  return (
    <div className={styles.container}>
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