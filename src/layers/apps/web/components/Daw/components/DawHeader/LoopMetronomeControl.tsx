import { useState, type ChangeEvent } from 'react';
import { useAudioRuntimeCapabilities, useCommandExecutor, useSession } from '@/layers/apps/web/context/layer-hooks';
import { describeAudioRuntimeFeatureCapability } from '@/layers/apps/web/utils/audio-runtime-capability-labels';
import { AudioCommandType } from '@/types/audioCommand.schema';
import * as styles from './LoopMetronomeControl.css.ts';

export function LoopMetronomeControl() {
  const commandExecutor = useCommandExecutor();
  const capability = useAudioRuntimeCapabilities().features.tempoLoopMetronome;
  const isLoopEnabled = useSession(state => state.isLoopEnabled);
  const loopRange = useSession(state => state.loopRange);
  const isMetronomeEnabled = useSession(state => state.isMetronomeEnabled);
  const metronomeVolume = useSession(state => state.metronomeVolume);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isUnavailable = capability.status !== 'available';
  const unavailableReason = isUnavailable ? describeAudioRuntimeFeatureCapability(capability) : undefined;

  const executeCommand = async (command: Parameters<typeof commandExecutor.execute>[0]) => {
    if (isPending || isUnavailable) {
      return;
    }

    setIsPending(true);
    try {
      await commandExecutor.execute(command);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsPending(false);
    }
  };

  const handleMetronomeVolumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    void executeCommand({
      type: AudioCommandType.SET_METRONOME,
      isEnabled: isMetronomeEnabled,
      volume: Number(event.currentTarget.value),
    });
  };

  const loopRangeLabel = loopRange
    ? `${formatSeconds(loopRange.startTimeSeconds)}–${formatSeconds(loopRange.endTimeSeconds)}초`
    : '범위 없음';

  return (
    <div aria-label="Loop 및 Metronome" className={styles.container} role="group" title={unavailableReason}>
      <button
        aria-label={isLoopEnabled ? 'Loop 끄기' : 'Loop 켜기'}
        aria-pressed={isLoopEnabled}
        className={styles.button}
        disabled={isPending || isUnavailable || (!isLoopEnabled && loopRange === null)}
        type="button"
        onClick={() => void executeCommand({ type: AudioCommandType.SET_LOOP_ENABLED, isEnabled: !isLoopEnabled })}
      >
        Loop
      </button>
      <span className={styles.rangeLabel}>{loopRangeLabel}</span>
      <button
        aria-label={isMetronomeEnabled ? 'Metronome 끄기' : 'Metronome 켜기'}
        aria-pressed={isMetronomeEnabled}
        className={styles.button}
        disabled={isPending || isUnavailable}
        type="button"
        onClick={() =>
          void executeCommand({
            type: AudioCommandType.SET_METRONOME,
            isEnabled: !isMetronomeEnabled,
            volume: metronomeVolume,
          })
        }
      >
        Click
      </button>
      <label className={styles.volume}>
        <span>Volume</span>
        <input
          aria-label="Metronome 볼륨"
          className={styles.range}
          disabled={isPending || isUnavailable}
          max="1"
          min="0"
          step="0.05"
          type="range"
          value={metronomeVolume}
          onChange={handleMetronomeVolumeChange}
        />
      </label>
      {errorMessage ? (
        <output aria-live="polite" className={styles.error}>
          {errorMessage}
        </output>
      ) : null}
    </div>
  );
}

function formatSeconds(seconds: number): string {
  return Number(seconds.toFixed(2)).toString();
}
