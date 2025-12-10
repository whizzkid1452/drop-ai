import type { AudioFile } from '@/components/DropZone/components/FileUpload/components/types';
import * as styles from './Track.css';

interface TrackProps {
  track: AudioFile;
  index: number;
  onRemove?: (index: number) => void;
}

export function Track({ track, index, onRemove }: TrackProps) {
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Ardour 레퍼런스 방식: 1024 기반 계산 (KB=1000, KiB=1024)
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  };

  return (
    <div className={styles.track}>
      <div className={styles.trackHeader}>
        <div className={styles.trackInfo}>
          <span className={styles.trackNumber}>{index + 1}</span>
          <div className={styles.trackDetails}>
            <span className={styles.trackName}>{track.name}</span>
            <span className={styles.trackMeta}>
              {formatDuration(track.duration)} • {formatFileSize(track.size)}
            </span>
          </div>
        </div>
        {onRemove && (
          <button
            className={styles.removeButton}
            onClick={() => onRemove(index)}
            aria-label="트랙 제거"
          >
            ×
          </button>
        )}
      </div>
      <div className={styles.trackContent}>
        <audio controls src={track.url} className={styles.audioPlayer} />
      </div>
    </div>
  );
}

