import { Track } from './Track/Track';
import type { AudioFile } from '../../../types/audioFile';
import * as styles from '../DawPage.css';

interface TrackListProps {
  tracks: AudioFile[];
  onRemove: (index: number) => void;
  onVolumeChange?: (index: number, volume: number) => void;
}

export function TrackList({
  tracks,
  onRemove,
  onVolumeChange,
}: TrackListProps) {
  return (
    <div className={styles.trackList}>
      {tracks.map((track, index) => (
        <Track
          key={`${track.name}-${index}`}
          track={track}
          index={index}
          onRemove={onRemove}
          onVolumeChange={onVolumeChange}
        />
      ))}
    </div>
  );
}
