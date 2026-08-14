import { useEffect, useState } from 'react';
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
const CLIP_LAUNCH_MODE_OPTIONS = ['trigger', 'gate', 'toggle', 'repeat'] as const;
const CLIP_FOLLOW_ACTION_OPTIONS = ['none', 'next', 'stop'] as const;

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
  const [name, setName] = useState(loopSlot.name);
  const [gain, setGain] = useState(loopSlot.gain);
  const [sourceStartTimeSeconds, setSourceStartTimeSeconds] = useState(loopSlot.sourceStartTimeSeconds);
  const [sourceEndTimeText, setSourceEndTimeText] = useState(
    loopSlot.sourceEndTimeSeconds === null ? '' : String(loopSlot.sourceEndTimeSeconds)
  );
  const [launchMode, setLaunchMode] = useState(loopSlot.launchMode);
  const [followActionType, setFollowActionType] = useState(loopSlot.followAction.type);
  const [followActionBars, setFollowActionBars] = useState(loopSlot.followAction.afterBars);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setName(loopSlot.name);
    setGain(loopSlot.gain);
    setSourceStartTimeSeconds(loopSlot.sourceStartTimeSeconds);
    setSourceEndTimeText(loopSlot.sourceEndTimeSeconds === null ? '' : String(loopSlot.sourceEndTimeSeconds));
    setLaunchMode(loopSlot.launchMode);
    setFollowActionType(loopSlot.followAction.type);
    setFollowActionBars(loopSlot.followAction.afterBars);
    setQuantizationBars(loopSlot.quantizationBars);
  }, [loopSlot]);

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
  const handleSaveSettings = () =>
    execute({
      followAction: { afterBars: followActionBars, type: followActionType },
      gain,
      launchMode,
      name,
      quantizationBars,
      slotId: loopSlot.id,
      sourceEndTimeSeconds: sourceEndTimeText.trim() === '' ? null : Number(sourceEndTimeText),
      sourceStartTimeSeconds,
      trackId,
      type: AudioCommandType.SET_CLIP_SLOT_SETTINGS,
    });
  const isGatePlayback = loopSlot.sourceId !== null && launchMode === 'gate';
  const handleGateStart = () => execute({ slotId: loopSlot.id, trackId, type: AudioCommandType.TRIGGER_LOOP_SLOT });
  const handleGateStop = () => execute({ slotId: loopSlot.id, trackId, type: AudioCommandType.STOP_LOOP_SLOT });
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
          onClick={isGatePlayback ? undefined : () => void handlePrimaryAction()}
          onPointerDown={isGatePlayback ? () => void handleGateStart() : undefined}
          onPointerUp={isGatePlayback ? () => void handleGateStop() : undefined}
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
      <button
        aria-expanded={isSettingsOpen}
        className={styles.settingsToggle}
        disabled={!isLoopAvailable}
        onClick={() => setIsSettingsOpen(current => !current)}
        type="button"
      >
        CLIP
      </button>
      {isSettingsOpen ? (
        <div className={styles.clipSettings}>
          <label className={styles.settingLabel}>
            NAME
            <input
              aria-label={`Loop ${index + 1} name`}
              className={styles.settingInput}
              maxLength={255}
              onChange={event => setName(event.currentTarget.value)}
              value={name}
            />
          </label>
          <label className={styles.settingLabel}>
            GAIN
            <input
              aria-label={`Loop ${index + 1} gain`}
              max="1"
              min="0"
              onChange={event => setGain(event.currentTarget.valueAsNumber)}
              step="0.01"
              type="range"
              value={gain}
            />
          </label>
          <label className={styles.settingLabel}>
            START
            <input
              aria-label={`Loop ${index + 1} source start`}
              className={styles.settingInput}
              min="0"
              onChange={event => setSourceStartTimeSeconds(event.currentTarget.valueAsNumber)}
              step="0.01"
              type="number"
              value={sourceStartTimeSeconds}
            />
          </label>
          <label className={styles.settingLabel}>
            END
            <input
              aria-label={`Loop ${index + 1} source end`}
              className={styles.settingInput}
              min="0"
              onChange={event => setSourceEndTimeText(event.currentTarget.value)}
              placeholder="FULL"
              step="0.01"
              type="number"
              value={sourceEndTimeText}
            />
          </label>
          <label className={styles.settingLabel}>
            MODE
            <select
              aria-label={`Loop ${index + 1} launch mode`}
              className={styles.settingSelect}
              onChange={event => setLaunchMode(event.currentTarget.value as typeof launchMode)}
              value={launchMode}
            >
              {CLIP_LAUNCH_MODE_OPTIONS.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.settingLabel}>
            FOLLOW
            <select
              aria-label={`Loop ${index + 1} follow action`}
              className={styles.settingSelect}
              onChange={event => setFollowActionType(event.currentTarget.value as typeof followActionType)}
              value={followActionType}
            >
              {CLIP_FOLLOW_ACTION_OPTIONS.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.settingLabel}>
            AFTER
            <select
              aria-label={`Loop ${index + 1} follow action bars`}
              className={styles.settingSelect}
              disabled={followActionType === 'none'}
              onChange={event => setFollowActionBars(Number(event.currentTarget.value) as LoopLengthBars)}
              value={followActionBars}
            >
              {LOOP_BAR_OPTIONS.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <button
            className={styles.saveSettingsButton}
            disabled={isPending || name.trim().length === 0 || !isLoopAvailable}
            onClick={() => void handleSaveSettings()}
            type="button"
          >
            SAVE
          </button>
        </div>
      ) : null}
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
