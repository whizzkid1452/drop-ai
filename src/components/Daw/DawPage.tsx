import { useTracks } from '@/contexts/TrackContext';
import { Track } from './components/Track/Track';
import * as styles from './DawPage.css';

export function DawPage() {
  const { tracks, removeTrack } = useTracks();

  if (tracks.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <h2 className={styles.emptyTitle}>트랙이 없습니다</h2>
          <p className={styles.emptyMessage}>
            파일을 업로드하면 여기에 트랙이 표시됩니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>트랙 목록</h1>
        <span className={styles.trackCount}>{tracks.length}개 트랙</span>
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
    </div>
  );
}