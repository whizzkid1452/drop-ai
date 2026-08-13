import { useState } from 'react';
import { useAudioRuntimeCapabilities, useCommandExecutor } from '@/layers/apps/web/context/layer-hooks';
import { describeAudioRuntimeFeatureCapability } from '@/layers/apps/web/utils/audio-runtime-capability-labels';
import {
  createLoopOverdubAction,
  createLoopSlotAction,
  getLoopLayerCount,
  getLoopSlotActionLabel,
} from '@/layers/apps/web/hooks/loop-slot-action';
import { MAX_LOOP_OVERDUB_LAYERS, type LoopLengthBars } from '@/layers/shared/loop-time';
import type { LoopSlotState } from '@/layers/session/session';
import { AudioCommandType } from '@/layers/shared/types/audioCommand.schema';
import { AudioRuntimeFeature } from '@/layers/shared/utils/audio-runtime-capabilities';
import * as styles from './LoopSlotControls.css';

const LOOP_BAR_OPTIONS: readonly LoopLengthBars[] = [1, 2, 4, 8];

function LoopSlotControl({
  index,
  loopSlot,
  loopUnavailableReason,
  isLoopAvailable,
  trackId,
}: {
  readonly index: number;
  readonly isLoopAvailable: boolean;
  readonly loopSlot: LoopSlotState;
  readonly loopUnavailableReason: string;
  readonly trackId: string;
}) {
  const commandExecutor = useCommandExecutor();
  const [lengthBars, setLengthBars] = useState(loopSlot.lengthBars);
  const [quantizationBars, setQuantizationBars] = useState(loopSlot.quantizationBars);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const execute = async (command: Parameters<typeof commandExecutor.execute>[0]) => {
    if (isPending || !isLoopAvailable) {
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
  const canOverdub =
    loopSlot.sourceId !== null &&
    loopSlot.state === 'playing' &&
    loopSlot.overdubSourceIds.length < MAX_LOOP_OVERDUB_LAYERS;

  return (
    <div className={styles.slot} data-state={loopSlot.state}>
      <div className={styles.slotHeader}>
        <span>LOOP {index + 1}</span>
        <span className={styles.state}>
          {loopSlot.state} · {getLoopLayerCount(loopSlot)}L
        </span>
      </div>
      <div className={styles.slotActions}>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={isPending || !isLoopAvailable}
          title={isLoopAvailable ? undefined : loopUnavailableReason}
          onClick={() => void handlePrimaryAction()}
        >
          {isPending ? '…' : getLoopSlotActionLabel(loopSlot.state)}
        </button>
        {canOverdub ? (
          <button
            type="button"
            className={styles.overdubButton}
            disabled={isPending || !isLoopAvailable}
            title={isLoopAvailable ? undefined : loopUnavailableReason}
            onClick={() => void execute(createLoopOverdubAction({ loopSlotId: loopSlot.id, trackId }))}
          >
            DUB
          </button>
        ) : null}
        {canClear ? (
          <button
            type="button"
            className={styles.clearButton}
            disabled={isPending || !isLoopAvailable}
            title={isLoopAvailable ? undefined : loopUnavailableReason}
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
            disabled={loopSlot.state !== 'empty' || isPending || !isLoopAvailable}
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
            disabled={loopSlot.state !== 'empty' || isPending || !isLoopAvailable}
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
  const capabilities = useAudioRuntimeCapabilities();
  const liveInputCapability = capabilities.features[AudioRuntimeFeature.LIVE_INPUT];
  const liveLoopCapability = capabilities.features[AudioRuntimeFeature.LIVE_LOOP];
  const isLiveInputAvailable = liveInputCapability.status === 'available';
  const isLiveLoopAvailable = liveLoopCapability.status === 'available';
  const liveInputUnavailableReason = describeAudioRuntimeFeatureCapability(liveInputCapability);
  const liveLoopUnavailableReason = describeAudioRuntimeFeatureCapability(liveLoopCapability);
  const unavailableReasons = [
    isLiveInputAvailable ? null : `실시간 입력: ${liveInputUnavailableReason}`,
    isLiveLoopAvailable ? null : `라이브 Loop: ${liveLoopUnavailableReason}`,
  ].filter((reason): reason is string => reason !== null);
  const isLoopAvailable = isLiveInputAvailable && isLiveLoopAvailable;
  const loopUnavailableReason = unavailableReasons.join(' / ');

  return (
    <section
      aria-disabled={!isLiveInputAvailable || !isLiveLoopAvailable}
      aria-label="Live loop controls"
      className={styles.container}
      title={unavailableReasons.join(' / ') || undefined}
    >
      <div className={styles.slotGrid}>
        {loopSlots.map((loopSlot, index) => (
          <LoopSlotControl
            index={index}
            isLoopAvailable={isLoopAvailable}
            key={loopSlot.id}
            loopSlot={loopSlot}
            loopUnavailableReason={loopUnavailableReason}
            trackId={trackId}
          />
        ))}
      </div>
    </section>
  );
}
