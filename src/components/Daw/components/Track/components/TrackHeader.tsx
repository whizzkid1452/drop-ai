import type { AudioFile } from '@/types/audioFile';
import * as styles from '../Track.css';

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
            {track.formattedDuration || '--:--'} • {track.formattedSize}
          </span>
        </div>
      </div>

      {onRemove && (
        <button
          className={styles.removeButton}
          onClick={() => onRemove(index)}
          aria-label="Remove track"
        >
          ×
        </button>
      )}
    </div>
  );
}
