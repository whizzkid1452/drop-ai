import { NavLink } from 'react-router-dom';
import type { AudioFile } from '../../types/audioFile';
import * as styles from './DropPreviewModal.css';

interface DropPreviewModalProps {
  audioFile: AudioFile;
  onClose: () => void;
}

export function DropPreviewModal({
  audioFile,
  onClose,
}: DropPreviewModalProps) {
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h2 className={styles.modalTitle}>Preview audio</h2>
        <audio src={audioFile.url} controls className={styles.audioPreview} />
        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
          >
            Close
          </button>
          <NavLink to="/daw" className={styles.editButton}>
            Go to track
          </NavLink>
        </div>
      </div>
    </div>
  );
}
