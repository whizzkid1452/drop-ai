import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AudioFile } from '@/types/audioFile';
import { AudioFileDrop } from '@/layers/apps/web/components/common/FileDrop/AudioFileDrop';
import * as styles from './DropPage.css.ts';
import { useSession } from '@/layers/apps/web/context/LayerContext';

export function DropPage() {
  const navigate = useNavigate();
  const resetAgentWorkflow = useSession(state => state.resetAgentWorkflow);

  const onAudioFileDrop = useCallback(
    (audioFile: AudioFile | null) => {
      if (audioFile == null) {
        return;
      }
      resetAgentWorkflow();
      navigate('/preview', { replace: true });
    },
    [navigate, resetAgentWorkflow]
  );

  return (
    <div className={styles.container}>
      <div className={styles.cardGroup}>
        <AudioFileDrop onAudioFileDrop={onAudioFileDrop} />
      </div>
    </div>
  );
}
