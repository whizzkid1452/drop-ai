import { useEffect, useRef, useState, type FormEvent } from 'react';
import * as styles from './MasterVolumeControl.css.ts';
import { useCommandExecutor, useSession } from '@/layers/apps/web/context/layer-hooks';
import { executeMasterVolumeChange, parseMasterVolumeInput } from '@/layers/apps/web/hooks/master-volume-command';

export function MasterVolumeControl() {
  const commandExecutor = useCommandExecutor();
  const sessionMasterVolume = useSession(state => state.masterVolume);
  const latestSessionMasterVolume = useRef(sessionMasterVolume);
  const [draftMasterVolume, setDraftMasterVolume] = useState(String(sessionMasterVolume));
  const [isPending, setIsPending] = useState(false);
  latestSessionMasterVolume.current = sessionMasterVolume;

  useEffect(() => {
    setDraftMasterVolume(String(sessionMasterVolume));
  }, [sessionMasterVolume]);

  const restoreSessionMasterVolume = () => setDraftMasterVolume(String(latestSessionMasterVolume.current));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) {
      return;
    }

    const volume = parseMasterVolumeInput(draftMasterVolume);
    if (volume === null) {
      window.alert('Master Volume은 0부터 1 사이의 숫자여야 합니다.');
      restoreSessionMasterVolume();
      return;
    }

    setIsPending(true);
    const result = await executeMasterVolumeChange({
      volume,
      executeCommand: command => commandExecutor.execute(command),
      notifyFailure: message => window.alert(message),
    });
    if (result === 'failed') {
      restoreSessionMasterVolume();
    }
    setIsPending(false);
  };

  return (
    <form className={styles.form} onSubmit={event => void handleSubmit(event)} noValidate>
      <label className={styles.label} htmlFor="master-volume-input">
        Master
      </label>
      <input
        id="master-volume-input"
        name="masterVolume"
        className={styles.input}
        type="number"
        min="0"
        max="1"
        step="0.01"
        inputMode="decimal"
        disabled={isPending}
        value={draftMasterVolume}
        onChange={event => setDraftMasterVolume(event.target.value)}
      />
      <button className={styles.button} type="submit" disabled={isPending}>
        {isPending ? '적용 중…' : '적용'}
      </button>
    </form>
  );
}
