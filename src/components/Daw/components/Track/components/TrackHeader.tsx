import type { AudioFile } from '@/components/DropZone/components/FileUpload/components/types';
import * as styles from '../Track.css';
import { formatDuration } from '../utils/format';

interface TrackHeaderProps {
  track: AudioFile;
  index: number;
  onRemove?: (index: number) => void;
}

export function TrackHeader({ track, index, onRemove }: TrackHeaderProps) {
  return (
    <div className={styles.trackHeader}>
      <div className={styles.trackInfo}>
        <span className={styles.trackNumber}>{index + 1}</span>

        <div className={styles.trackDetails}>
          <span className={styles.trackName}>{track.name}</span>
          <span className={styles.trackMeta}>
            {formatDuration(track.duration)} • {track.formattedSize}
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
  );
}

