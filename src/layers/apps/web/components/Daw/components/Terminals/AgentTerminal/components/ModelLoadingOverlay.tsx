import * as styles from '../ChatModalTerminal.css.ts';
import { formatLoadingDisplayText } from '../utils/formatLoadingDisplayText';

interface ModelLoadingOverlayProps {
  progress: number;
  loadingText: string;
}

export function ModelLoadingOverlay({
  progress,
  loadingText,
}: ModelLoadingOverlayProps) {
  const displayText = formatLoadingDisplayText(loadingText);

  return (
    <div className={styles.loadingArea}>
      <div className={styles.progressBarContainer}>
        <div
          className={styles.progressBar}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className={styles.statusStrip}>
        <div className={styles.statusInfo}>
          <span
            className={`material-symbols-outlined ${styles.spinning}`}
            style={{
              fontSize: '14px',
              color: styles.primaryColor,
            }}
            aria-hidden
          >
            sync
          </span>
          <span className={styles.statusText}>{displayText}</span>
          <span className={styles.statusLabel}>MODEL: LLAMA-3-OPTIMIZED</span>
        </div>
        <span className={styles.statusText}>{progress}%</span>
      </div>
    </div>
  );
}
