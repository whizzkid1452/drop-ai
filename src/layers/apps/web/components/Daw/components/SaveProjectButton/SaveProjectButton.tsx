import { useRef, useState } from 'react';
import { useCommandExecutor } from '@/layers/apps/web/context/layer-hooks';
import { AudioCommandType } from '@/types/audioCommand.schema';
import * as styles from './SaveProjectButton.css';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function SaveProjectButton() {
  const commandExecutor = useCommandExecutor();
  const isSavingRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSave = async () => {
    if (isSavingRef.current) {
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    setIsSaved(false);
    setErrorMessage(null);

    try {
      await commandExecutor.execute({ type: AudioCommandType.SAVE_PROJECT });
      setIsSaved(true);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const buttonText = isSaving ? 'Saving...' : errorMessage ? 'Retry save' : 'Save';

  return (
    <div className={styles.container}>
      <button className={styles.button} type="button" onClick={handleSave} disabled={isSaving}>
        {buttonText}
      </button>
      {isSaved ? (
        <span className={styles.status} role="status">
          Save completed
        </span>
      ) : null}
      {errorMessage ? (
        <span className={styles.error} role="alert">
          저장 실패: {errorMessage}
        </span>
      ) : null}
    </div>
  );
}
