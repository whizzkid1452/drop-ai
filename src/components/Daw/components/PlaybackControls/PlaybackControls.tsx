import { useAudioEngineHandleWithUi } from '@/hooks/agent/useAudioEngineHandleWithUi';
import { AudioCommandType } from '@/types/audioCommand.schema';
import * as styles from './PlaybackControls.css';
import { usePlaybackStore } from '@/stores/usePlaybackStore';

export function PlaybackControls() {
  const { handleAudioCommand } = useAudioEngineHandleWithUi();
  const isPlaying = usePlaybackStore(state => state.isPlaying);

  const handlePlay = () => handleAudioCommand({ type: AudioCommandType.PLAY });
  const handlePause = () =>
    handleAudioCommand({ type: AudioCommandType.PAUSE });
  const handleStop = () => handleAudioCommand({ type: AudioCommandType.STOP });

  return (
    <div className={styles.container}>
      <button className={styles.button} onClick={handleStop} title="Stop">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      </button>

      {isPlaying ? (
        <button
          className={styles.playButton}
          onClick={handlePause}
          title="Pause"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        </button>
      ) : (
        <button className={styles.playButton} onClick={handlePlay} title="Play">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}
    </div>
  );
}
