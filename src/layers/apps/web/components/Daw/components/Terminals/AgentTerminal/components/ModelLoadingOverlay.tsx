import type { AgentModelStatus } from '@/types/agent';
import * as styles from '../ChatModalTerminal.css.ts';
import { formatLoadingDisplayText } from '../utils/formatLoadingDisplayText';

interface ModelLoadingOverlayProps {
  status: Exclude<AgentModelStatus, 'ready'>;
  progress: number;
  loadingText: string;
  onRetry: () => void;
}

function toProgressPercentage(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 0;
  }

  return Math.round(Math.min(1, Math.max(0, progress)) * 100);
}

export function ModelLoadingOverlay({ status, progress, loadingText, onRetry }: ModelLoadingOverlayProps) {
  if (status === 'error') {
    return (
      <div className={styles.loadingArea} role="alert">
        <div className={styles.statusStrip}>
          <div className={styles.statusInfo}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '14px', color: styles.primaryColor }}
              aria-hidden
            >
              error
            </span>
            <div>
              <div className={styles.statusText}>MODEL LOAD FAILED</div>
              <div className={styles.statusDescription}>
                Check the network connection and WebGPU support, then retry. {loadingText}
              </div>
            </div>
          </div>
          <button className={styles.retryButton} type="button" onClick={onRetry}>
            RETRY
          </button>
        </div>
      </div>
    );
  }

  const displayText = formatLoadingDisplayText(loadingText);
  const progressPercentage = toProgressPercentage(progress);

  return (
    <div className={styles.loadingArea} role="status" aria-live="polite">
      <div
        className={styles.progressBarContainer}
        role="progressbar"
        aria-label="AI model preparation progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercentage}
      >
        <div className={styles.progressBar} style={{ width: `${progressPercentage}%` }} />
      </div>
      <div className={styles.statusStrip}>
        <div className={styles.statusInfo}>
          <span
            className={`material-symbols-outlined ${styles.spinning}`}
            style={{ fontSize: '14px', color: styles.primaryColor }}
            aria-hidden
          >
            sync
          </span>
          <div>
            <div className={styles.statusText}>AI MODEL IS NOT READY</div>
            <div className={styles.statusDescription}>{displayText}</div>
          </div>
          <span className={styles.statusLabel}>MODEL: QWEN2.5 0.5B</span>
        </div>
        <span className={styles.statusText}>{progressPercentage}%</span>
      </div>
    </div>
  );
}
