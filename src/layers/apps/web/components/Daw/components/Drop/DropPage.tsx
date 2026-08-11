import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AudioFile } from '@/types/audioFile';
import { AudioFileDrop } from '@/layers/apps/web/components/common/FileDrop/AudioFileDrop';
import * as styles from './DropPage.css.ts';
import { useSession } from '@/layers/apps/web/context/layer-hooks';
import { AccountControl } from '@/layers/apps/web/components/Auth/AccountControl';
import { LoadProjectControl } from '../LoadProjectControl/LoadProjectControl';

export function DropPage() {
  const navigate = useNavigate();
  const resetAgentWorkflow = useSession(state => state.resetAgentWorkflow);

  const onAudioFileDrop = useCallback(
    (audioFile: AudioFile | null) => {
      if (audioFile == null) {
        return;
      }
      resetAgentWorkflow();
      navigate('/daw', { replace: true });
    },
    [navigate, resetAgentWorkflow]
  );
  const onProjectLoaded = useCallback(() => {
    navigate('/daw', { replace: true });
  }, [navigate]);

  return (
    <div className={styles.container}>
      <div className={styles.accountControl}>
        <AccountControl />
      </div>
      <div className={styles.cardGroup}>
        <AudioFileDrop onAudioFileDrop={onAudioFileDrop} />
        <LoadProjectControl onProjectLoaded={onProjectLoaded} />
      </div>
    </div>
  );
}
