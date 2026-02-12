import { ErrorBoundary, useErrorBoundary, type FallbackProps } from 'react-error-boundary';
import * as styles from './PlaybackControls.css.ts';
import { AudioEngineError, getUserFriendlyMessage } from '@/layers/audio-engine/errors';
import { useController, useSession } from '@/layers/apps/web/context/LayerContext';

function PlaybackErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const message = error instanceof AudioEngineError ? getUserFriendlyMessage(error) : 'Playback Error';
  
  return (
    <div className={styles.container} style={{ borderColor: '#ff4444' }}>
      <button className={styles.button} onClick={resetErrorBoundary} title="Retry">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#ff4444">
          <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
        </svg>
      </button>
      <span style={{ fontSize: '12px', color: '#ff4444', marginLeft: '8px' }}>
        {message}
      </span>
    </div>
  );
}

function PlaybackControlsContent() {
  const controller = useController();
  const isPlaying = useSession(state => state.isPlaying);
  const { showBoundary } = useErrorBoundary();

  const handlePlay = async () => {
    try {
      await controller.playback.handlePlay();
    } catch (error) {
      showBoundary(error);
    }
  };

  const handlePause = async () => {
    try {
      controller.playback.handlePause();
    } catch (error) {
      showBoundary(error);
    }
  };

  const handleStop = async () => {
    try {
      controller.playback.handleStop();
    } catch (error) {
      showBoundary(error);
    }
  };

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

export function PlaybackControls() {
  return (
    <ErrorBoundary FallbackComponent={PlaybackErrorFallback}>
      <PlaybackControlsContent />
    </ErrorBoundary>
  );
}
