import { useState } from 'react';
import { useCommandExecutor } from '@/layers/apps/web/context/layer-hooks';
import { createLoopSlotAction, getLoopSlotActionLabel } from '@/layers/apps/web/hooks/loop-slot-action';
import type { LoopLengthBars } from '@/layers/shared/loop-time';
import type { LoopSlotState } from '@/layers/session/session';
import { AudioCommandType } from '@/layers/shared/types/audioCommand.schema';
import * as styles from './LoopSlotControls.css';

const LOOP_BAR_OPTIONS: readonly LoopLengthBars[] = [1, 2, 4, 8];

function LoopSlotControl({
  index,
  loopSlot,
  trackId,
}: {
  readonly index: number;
  readonly loopSlot: LoopSlotState;
  readonly trackId: string;
}) {
  const commandExecutor = useCommandExecutor();
  const [lengthBars, setLengthBars] = useState(loopSlot.lengthBars);
  const [quantizationBars, setQuantizationBars] = useState(loopSlot.quantizationBars);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const execute = async (command: Parameters<typeof commandExecutor.execute>[0]) => {
    if (isPending) {
      return;
    }
    setIsPending(true);
    setErrorMessage(null);
    try {
      await commandExecutor.execute(command);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '루프 명령을 실행하지 못했습니다.');
    } finally {
      setIsPending(false);
    }
  };

  const handlePrimaryAction = () => execute(createLoopSlotAction({ lengthBars, loopSlot, quantizationBars, trackId }));
  const canClear = loopSlot.sourceId !== null && loopSlot.state !== 'error';

  return (
    <div className={styles.slot} data-state={loopSlot.state}>
      <div className={styles.slotHeader}>
        <span>LOOP {index + 1}</span>
        <span className={styles.state}>{loopSlot.state}</span>
      </div>
      <div className={styles.slotActions}>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={isPending}
          onClick={() => void handlePrimaryAction()}
        >
          {isPending ? '…' : getLoopSlotActionLabel(loopSlot.state)}
        </button>
        {canClear ? (
          <button
            type="button"
            className={styles.clearButton}
            disabled={isPending}
            onClick={() => void execute({ slotId: loopSlot.id, trackId, type: AudioCommandType.CLEAR_LOOP_SLOT })}
          >
            ×
          </button>
        ) : null}
      </div>
      <div className={styles.slotSettings}>
        <label className={styles.settingLabel}>
          LEN
          <select
            aria-label={`Loop ${index + 1} length`}
            className={styles.settingSelect}
            disabled={loopSlot.state !== 'empty' || isPending}
            value={lengthBars}
            onChange={event => setLengthBars(Number(event.target.value) as LoopLengthBars)}
          >
            {LOOP_BAR_OPTIONS.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.settingLabel}>
          Q
          <select
            aria-label={`Loop ${index + 1} quantization`}
            className={styles.settingSelect}
            disabled={loopSlot.state !== 'empty' || isPending}
            value={quantizationBars}
            onChange={event => setQuantizationBars(Number(event.target.value) as LoopLengthBars)}
          >
            {LOOP_BAR_OPTIONS.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
      {errorMessage || loopSlot.errorMessage ? (
        <span className={styles.error} title={errorMessage ?? loopSlot.errorMessage ?? undefined}>
          ERROR
        </span>
      ) : null}
    </div>
  );
}

export function LoopSlotControls({
  loopSlots,
  trackId,
}: {
  readonly loopSlots: readonly LoopSlotState[];
  readonly trackId: string;
}) {
  const commandExecutor = useCommandExecutor();
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isInputPending, setIsInputPending] = useState(false);
  const [inputErrorMessage, setInputErrorMessage] = useState<string | null>(null);

  const handleDefaultInput = async () => {
    setIsInputPending(true);
    setInputErrorMessage(null);
    try {
      await commandExecutor.execute({ deviceId: null, type: AudioCommandType.SET_AUDIO_INPUT_DEVICE });
    } catch (error) {
      setInputErrorMessage(error instanceof Error ? error.message : '입력 장치를 선택하지 못했습니다.');
    } finally {
      setIsInputPending(false);
    }
  };

  const handleMonitoring = async () => {
    const enabled = !isMonitoring;
    setIsInputPending(true);
    setInputErrorMessage(null);
    try {
      await commandExecutor.execute({ enabled, trackId, type: AudioCommandType.SET_INPUT_MONITORING });
      setIsMonitoring(enabled);
    } catch (error) {
      setInputErrorMessage(error instanceof Error ? error.message : '입력 모니터링을 변경하지 못했습니다.');
    } finally {
      setIsInputPending(false);
    }
  };

  return (
    <section className={styles.container} aria-label="Live loop controls">
      <div className={styles.inputControls}>
        <button
          type="button"
          className={styles.inputButton}
          disabled={isInputPending}
          onClick={() => void handleDefaultInput()}
        >
          DEFAULT INPUT
        </button>
        <button
          type="button"
          aria-pressed={isMonitoring}
          className={`${styles.inputButton} ${isMonitoring ? styles.monitoringActive : ''}`}
          disabled={isInputPending}
          onClick={() => void handleMonitoring()}
        >
          MON {isMonitoring ? 'ON' : 'OFF'}
        </button>
      </div>
      <div className={styles.slotGrid}>
        {loopSlots.map((loopSlot, index) => (
          <LoopSlotControl key={loopSlot.id} index={index} loopSlot={loopSlot} trackId={trackId} />
        ))}
      </div>
      {inputErrorMessage ? <span className={styles.error}>{inputErrorMessage}</span> : null}
    </section>
  );
}
