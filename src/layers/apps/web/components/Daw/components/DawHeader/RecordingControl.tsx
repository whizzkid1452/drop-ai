import { useState, type ChangeEvent } from 'react';
import {
  useAudioRuntimeCapabilities,
  useCommandExecutor,
  useEditorRuntimeState,
  useRecordingRuntimeState,
  useSession,
} from '@/layers/apps/web/context/layer-hooks';
import { describeAudioRuntimeFeatureCapability } from '@/layers/apps/web/utils/audio-runtime-capability-labels';
import type { CommandExecutionResult } from '@/layers/commands/command-executor';
import type { MultiTrackRecordingResult } from '@/layers/shared/types/linear-recording';
import { AudioCommandType } from '@/layers/shared/types/audioCommand.schema';
import { AudioRuntimeFeature } from '@/layers/shared/utils/audio-runtime-capabilities';
import * as styles from './RecordingControl.css.ts';

const COUNT_IN_OPTIONS = [0, 1, 2, 3, 4] as const;

const recordingPhaseLabels = {
  idle: '대기',
  scheduled: 'Count-in',
  recording: '녹음 중',
  stopping: '저장 중',
} as const;

export function RecordingControl() {
  const commandExecutor = useCommandExecutor();
  const capability = useAudioRuntimeCapabilities().features[AudioRuntimeFeature.LINEAR_RECORDING];
  const recordingState = useRecordingRuntimeState();
  const selectedRange = useEditorRuntimeState().selection.range;
  const punch = useSession(state => state.recording.punch);
  const [countInBars, setCountInBars] = useState(0);
  const [prerollSeconds, setPrerollSeconds] = useState(0);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isIdle = recordingState.phase === 'idle';
  const isStopping = recordingState.phase === 'stopping';
  const unavailableReason =
    capability.status === 'available' ? undefined : describeAudioRuntimeFeatureCapability(capability);
  const cannotStartReason =
    isIdle && recordingState.armedTrackIds.length === 0 ? '녹음 arm된 Track이 필요합니다.' : undefined;

  const executeRecordingCommand = async () => {
    if (isPending || isStopping || unavailableReason || cannotStartReason) {
      return;
    }

    setIsPending(true);
    try {
      const result = await commandExecutor.execute(
        isIdle
          ? {
              countInBars,
              prerollSeconds,
              type: AudioCommandType.START_RECORDING,
            }
          : { type: AudioCommandType.STOP_RECORDING }
      );
      setErrorMessage(describeRecordingFailures(result));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsPending(false);
    }
  };

  const handleUseSelectionForPunch = async () => {
    if (!isIdle || isPending || !selectedRange || unavailableReason) {
      return;
    }

    await executePunchCommand({
      isEnabled: true,
      range: {
        endTimeSeconds: selectedRange.endTimeSeconds,
        startTimeSeconds: selectedRange.startTimeSeconds,
      },
    });
  };

  const handlePunchToggle = async () => {
    const nextRange = punch.range ?? selectedRange;
    if (!isIdle || isPending || unavailableReason || (!punch.isEnabled && !nextRange)) {
      return;
    }

    await executePunchCommand({
      isEnabled: !punch.isEnabled,
      range: nextRange
        ? { endTimeSeconds: nextRange.endTimeSeconds, startTimeSeconds: nextRange.startTimeSeconds }
        : punch.range,
    });
  };

  const executePunchCommand = async (request: {
    readonly isEnabled: boolean;
    readonly range: { readonly endTimeSeconds: number; readonly startTimeSeconds: number } | null;
  }) => {
    setIsPending(true);
    try {
      await commandExecutor.execute({ ...request, type: AudioCommandType.SET_PUNCH_RECORDING });
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(describeError(error));
    } finally {
      setIsPending(false);
    }
  };

  const handleCancel = async () => {
    if (isIdle || isPending || unavailableReason) {
      return;
    }

    setIsPending(true);
    try {
      await commandExecutor.execute({ type: AudioCommandType.CANCEL_RECORDING });
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsPending(false);
    }
  };

  const handlePrerollChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPrerollSeconds(Number(event.currentTarget.value));
  };

  return (
    <div
      aria-label="녹음"
      className={styles.container}
      role="group"
      title={errorMessage ?? unavailableReason ?? cannotStartReason}
    >
      <label className={styles.field}>
        <span>Count-in</span>
        <select
          aria-label="Count-in 마디"
          className={styles.input}
          disabled={!isIdle || isPending || Boolean(unavailableReason)}
          value={countInBars}
          onChange={event => setCountInBars(Number(event.currentTarget.value))}
        >
          {COUNT_IN_OPTIONS.map(value => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>Preroll</span>
        <input
          aria-label="Preroll 초"
          className={styles.input}
          disabled={!isIdle || isPending || Boolean(unavailableReason)}
          max="60"
          min="0"
          step="0.5"
          type="number"
          value={prerollSeconds}
          onChange={handlePrerollChange}
        />
      </label>
      <button
        aria-label="선택 범위를 Punch로 설정"
        className={styles.button}
        disabled={!isIdle || isPending || !selectedRange || Boolean(unavailableReason)}
        onClick={() => void handleUseSelectionForPunch()}
        type="button"
      >
        Punch Range
      </button>
      <button
        aria-label={punch.isEnabled ? 'Punch 녹음 끄기' : 'Punch 녹음 켜기'}
        aria-pressed={punch.isEnabled}
        className={`${styles.button} ${punch.isEnabled ? styles.punchButtonActive : ''}`}
        disabled={
          !isIdle || isPending || Boolean(unavailableReason) || (!punch.isEnabled && !punch.range && !selectedRange)
        }
        onClick={() => void handlePunchToggle()}
        type="button"
      >
        Punch
      </button>
      {punch.range ? (
        <span className={styles.rangeStatus}>
          P {punch.range.startTimeSeconds.toFixed(2)}–{punch.range.endTimeSeconds.toFixed(2)}
        </span>
      ) : null}
      <button
        aria-label={isIdle ? '녹음 시작' : '녹음 중지'}
        aria-pressed={!isIdle}
        className={`${styles.recordingButton} ${isIdle ? '' : styles.recordingButtonActive}`}
        disabled={isPending || isStopping || Boolean(unavailableReason) || Boolean(cannotStartReason)}
        onClick={() => void executeRecordingCommand()}
        type="button"
      >
        ● REC
      </button>
      {!isIdle ? (
        <button
          aria-label="녹음 취소"
          className={styles.button}
          disabled={isPending || Boolean(unavailableReason)}
          onClick={() => void handleCancel()}
          type="button"
        >
          Cancel
        </button>
      ) : null}
      <output aria-live="polite" className={styles.status}>
        {recordingPhaseLabels[recordingState.phase]}
      </output>
      {errorMessage ? <span className={styles.error}>{errorMessage}</span> : null}
    </div>
  );
}

function describeRecordingFailures(result: CommandExecutionResult): string | null {
  if (!isMultiTrackRecordingResult(result) || result.failures.length === 0) {
    return null;
  }

  const failedTracks = result.failures.map(failure => `${failure.trackId} (${failure.stage})`).join(', ');
  return `${result.failures.length}개 Track 녹음 실패: ${failedTracks}`;
}

function isMultiTrackRecordingResult(result: CommandExecutionResult): result is MultiTrackRecordingResult {
  return typeof result === 'object' && result !== null && 'failures' in result && 'takes' in result;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
