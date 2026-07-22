import { useEffect, useRef, useState, type FormEvent } from 'react';
import * as styles from './TempoMetadataControl.css.ts';
import { useCommandExecutor, useSession } from '@/layers/apps/web/context/layer-hooks';
import { executeTempoMetadataChange, parseTempoInput } from '@/layers/apps/web/hooks/tempo-metadata-command';

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
    const result = await executeTempoMetadataChange({
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
      title="현재는 프로젝트 정보만 바꾸며 오디오 속도는 바뀌지 않습니다."
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
        오디오 속도 미변경
      </span>
    </form>
  );
}
