import { Track } from './Track/Track';
import type { AudioFile } from './FileUpload/components/types';
import * as styles from '../DawPage.css';

interface TrackListProps {
  tracks: AudioFile[];
  onRemove: (index: number) => void;
  onVolumeChange?: (index: number, volume: number) => void;
  onPanChange?: (index: number, pan: number) => void;
}

export function TrackList({
  tracks,
  onRemove,
  onVolumeChange,
  onPanChange,
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
          onPanChange={onPanChange}
        />
      ))}
    </div>
  );
}
