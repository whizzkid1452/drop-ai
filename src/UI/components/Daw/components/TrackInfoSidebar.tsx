import * as styles from './TrackInfoSidebar.css';
import { useAudioService } from '@/AudioEngine/FACADE/useAudioEngineFacade';
import type { AudioSnapshot } from '@/types/audioTypes';
import type { TrackData } from '@/AudioEngine/track/Track';

/** @description For Debugging */
export function TrackInfoSidebar() {
  const tracks = useAudioService((state: AudioSnapshot) => state.tracks);

  // Convert array to object for display (keyed by track id)
  const tracksDisplay = tracks.reduce(
    (acc: Record<string, TrackData>, track: TrackData) => ({
      ...acc,
      [track.id]: {
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
        {tracks.length === 0 ? (
          <div className={styles.emptyMessage}>
            No tracks available. Add audio files to see track information.
          </div>
        ) : (
          <pre className={styles.pre}>
            {JSON.stringify(tracksDisplay, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
