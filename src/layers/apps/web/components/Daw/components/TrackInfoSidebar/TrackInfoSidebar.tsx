import * as styles from './TrackInfoSidebar.css.ts';
import { useSession } from '@/layers/apps/web/context/layer-hooks';

/** @description For Debugging */
export function TrackInfoSidebar() {
  const tracksMap = useSession(state => state.tracks);
  const tracks = Array.from(tracksMap.values());

  // Convert array to object for display (keyed by track id)
  const tracksDisplay = tracks.reduce(
    (acc, track) => ({
      ...acc,
      [track.id]: {
        ...track,
      },
    }),
    {}
  );

  return (
    <div className={styles.container}>
      <div className={styles.titleBar}>Track Store Info</div>
      <div className={styles.contentArea}>
        {tracks.length === 0 ? (
          <div className={styles.emptyMessage}>No tracks available. Add audio files to see track information.</div>
        ) : (
          <pre className={styles.pre}>{JSON.stringify(tracksDisplay, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}
