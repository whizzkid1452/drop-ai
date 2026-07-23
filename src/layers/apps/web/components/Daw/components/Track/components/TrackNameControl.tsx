import { useEffect, useRef, useState, type FormEvent } from 'react';
import * as styles from './TrackNameControl.css.ts';
import { useCommandExecutor } from '@/layers/apps/web/context/layer-hooks';
import {
  executeTrackNameChange,
  normalizeTrackName,
  TRACK_NAME_MAX_LENGTH,
} from '@/layers/apps/web/hooks/track-name-command';

interface TrackNameControlProps {
  readonly name: string;
  readonly trackId: string;
}

export function TrackNameControl({ trackId, name }: TrackNameControlProps) {
  const commandExecutor = useCommandExecutor();
  const latestName = useRef(name);
  const [draftName, setDraftName] = useState(name);
  const [isPending, setIsPending] = useState(false);
  latestName.current = name;

  useEffect(() => {
    setDraftName(name);
  }, [name]);

  const restoreCurrentName = () => setDraftName(latestName.current);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) {
      return;
    }

    const normalizedName = normalizeTrackName(draftName);
    if (normalizedName === null) {
      window.alert(`Track 이름은 1자부터 ${TRACK_NAME_MAX_LENGTH}자까지 입력해야 합니다.`);
      restoreCurrentName();
      return;
    }

    setIsPending(true);
    const result = await executeTrackNameChange({
      trackId,
      name: normalizedName,
      executeCommand: command => commandExecutor.execute(command),
      notifyFailure: message => window.alert(message),
    });
    if (result === 'failed') {
      restoreCurrentName();
    }
    setIsPending(false);
  };

  return (
    <form className={styles.form} onSubmit={event => void handleSubmit(event)} noValidate>
      <label className={styles.label} htmlFor={`track-name-${trackId}`}>
        Track 이름
      </label>
      <input
        id={`track-name-${trackId}`}
        name="trackName"
        className={styles.input}
        type="text"
        maxLength={TRACK_NAME_MAX_LENGTH}
        disabled={isPending}
        value={draftName}
        onChange={event => setDraftName(event.target.value)}
      />
      <button className={styles.button} type="submit" disabled={isPending}>
        {isPending ? '적용 중…' : '이름 적용'}
      </button>
    </form>
  );
}
