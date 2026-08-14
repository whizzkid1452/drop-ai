import { useEffect, useRef, useState, type FormEvent } from 'react';
import * as styles from './TempoMetadataControl.css.ts';
import { useCommandExecutor, useSession } from '@/layers/apps/web/context/layer-hooks';
import { executeTempoChange, parseTempoInput } from '@/layers/apps/web/hooks/tempo-metadata-command';

const TEMPO_HINT_ID = 'tempo-metadata-hint';

export function TempoMetadataControl() {
  const commandExecutor = useCommandExecutor();
  const sessionTempo = useSession(state => state.tempo);
  const latestSessionTempo = useRef(sessionTempo);
  const [draftTempo, setDraftTempo] = useState(String(sessionTempo));
  const [isPending, setIsPending] = useState(false);
  latestSessionTempo.current = sessionTempo;

  useEffect(() => {
    setDraftTempo(String(sessionTempo));
  }, [sessionTempo]);

  const restoreSessionTempo = () => setDraftTempo(String(latestSessionTempo.current));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) {
      return;
    }

    const tempo = parseTempoInput(draftTempo);
    if (tempo === null) {
      window.alert('Tempo는 0보다 큰 숫자여야 합니다.');
      restoreSessionTempo();
      return;
    }

    setIsPending(true);
    const result = await executeTempoChange({
      tempo,
      executeCommand: command => commandExecutor.execute(command),
      notifyFailure: message => window.alert(message),
    });
    if (result === 'failed') {
      restoreSessionTempo();
    }
    setIsPending(false);
  };

  return (
    <form
      className={styles.form}
      onSubmit={event => void handleSubmit(event)}
      noValidate
      title="Tempo Map 변경을 오디오 scheduler와 프로젝트 문서에 함께 반영합니다."
    >
      <label className={styles.label} htmlFor="tempo-metadata-input">
        Tempo
      </label>
      <input
        id="tempo-metadata-input"
        name="tempo"
        className={styles.input}
        type="number"
        min="0"
        step="any"
        inputMode="decimal"
        aria-describedby={TEMPO_HINT_ID}
        disabled={isPending}
        value={draftTempo}
        onChange={event => setDraftTempo(event.target.value)}
      />
      <span className={styles.unit}>BPM</span>
      <button className={styles.button} type="submit" disabled={isPending}>
        {isPending ? '적용 중…' : '적용'}
      </button>
      <span id={TEMPO_HINT_ID} className={styles.hint}>
        오디오 scheduler에 반영
      </span>
    </form>
  );
}
