import { Track } from './Track/Track';
import * as styles from '../DawPage.css';
import { useTrackStore } from '@/stores/useTrackStore';
import { useMemo } from 'react';

interface TrackListProps {
  onRemove: (index: number) => void;
  onVolumeChange?: (index: number, volume: number) => void;
}

export function TrackList({ onRemove, onVolumeChange }: TrackListProps) {
  const tracks = useTrackStore(state => state.tracks);
  const trackArray = useMemo(() => Array.from(tracks.values()), [tracks]);

  return (
    <div className={styles.trackList}>
      {trackArray.map((track, index) => (
        <Track
          key={track.id}
          // @todo: 추후 여러 리전 처리 필요
          track={track.regions[0].audioFile}
          index={index}
          onRemove={onRemove}
          onVolumeChange={onVolumeChange}
        />
      ))}
    </div>
  );
}
