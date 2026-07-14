import { ExportButton } from '@/layers/apps/web/components/Daw/components/ExportButton/ExportButton';
import { PlaybackControls } from '@/layers/apps/web/components/Daw/components/PlaybackControls/PlaybackControls';
import * as styles from './AgentPreviewPage.css';

interface PreviewActionBarProps {
  onGoEdit: () => void;
}

export function PreviewActionBar({ onGoEdit }: PreviewActionBarProps) {
  return (
    <div className={styles.actionBar} aria-label="Agent result actions">
      <div className={styles.actionGroup}>
        <span className={styles.status}>Preview ready</span>
        <PlaybackControls layout="inline" />
      </div>
      <div className={styles.actionGroup}>
        <ExportButton />
        <button className={styles.goEditButton} type="button" onClick={onGoEdit}>
          Go Edit
        </button>
      </div>
    </div>
  );
}
