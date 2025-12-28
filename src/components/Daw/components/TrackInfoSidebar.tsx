import * as styles from './TrackInfoSidebar.css';
import { useTrackStore } from '@/stores/useTrackStore';

/** @description For Debugging */
export function TrackInfoSidebar() {
  const tracks = useTrackStore(state => state.tracks);

  // Convert Map to array of objects for display
  const tracksDisplay = Array.from(tracks.entries()).reduce(
    (acc, [id, track]) => ({
      ...acc,
      [id]: {
        ...track,
        // Optional: simplify complex objects if needed,
        // e.g. replacing AudioFile blob with url
      },
    }),
    {}
  );

  return (
    <div className={styles.container}>
      <div className={styles.titleBar}>Track Store Info</div>
      <div className={styles.contentArea}>
        <pre className={styles.pre}>
          {JSON.stringify(tracksDisplay, null, 2)}
        </pre>
      </div>
    </div>
  );
}
