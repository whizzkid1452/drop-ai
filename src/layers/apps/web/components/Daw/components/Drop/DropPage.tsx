import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AudioFile } from '@/types/audioFile';
import { AudioFileDrop } from '@/layers/apps/web/components/common/FileDrop/AudioFileDrop';
import * as styles from './DropPage.css.ts';

export function DropPage() {
  const navigate = useNavigate();

  const onAudioFileDrop = useCallback(
    (audioFile: AudioFile | null) => {
      if (audioFile == null) {
        return;
      }
      navigate('/daw');
    },
    [navigate]
  );

  return (
    <div className={styles.container}>
      <div className={styles.cardGroup}>
        <AudioFileDrop onAudioFileDrop={onAudioFileDrop} />
      </div>
    </div>
  );
}
