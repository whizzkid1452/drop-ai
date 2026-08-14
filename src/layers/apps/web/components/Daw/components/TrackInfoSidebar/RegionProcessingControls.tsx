import { useCallback, useState } from 'react';
import { useCommandExecutor } from '@/layers/apps/web/context/layer-hooks';
import type { RegionState } from '@/layers/session/session';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import * as styles from './RegionProcessingControls.css.ts';

interface RegionProcessingControlsProps {
  readonly region: RegionState;
  readonly trackId: string;
}

export function RegionProcessingControls({ region, trackId }: RegionProcessingControlsProps) {
  const commandExecutor = useCommandExecutor();
  const [stretchRatio, setStretchRatio] = useState(1);
  const [pitchSemitones, setPitchSemitones] = useState(0);
  const [transientSensitivity, setTransientSensitivity] = useState(0.75);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const execute = useCallback(
    async (command: AudioCommand) => {
      try {
        await commandExecutor.execute(command);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : String(error));
      }
    },
    [commandExecutor]
  );
  const setProcessing = (update: Omit<Extract<AudioCommand, { type: 'SET_REGION_PROCESSING' }>, 'type'>) =>
    execute({ type: AudioCommandType.SET_REGION_PROCESSING, ...update });
  const executeDerivedAction = async (action: string, command: AudioCommand) => {
    if (pendingAction !== null) {
      return;
    }
    setPendingAction(action);
    try {
      await execute(command);
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className={styles.control} data-region-id={region.id}>
      <RangeControl
        label="Region gain"
        max={4}
        step={0.01}
        value={region.gain}
        onChange={gain => setProcessing({ gain, regionId: region.id, trackId })}
      />
      <RangeControl
        label="Region fade in"
        max={region.duration}
        step={0.01}
        value={region.fadeIn.durationSeconds}
        onChange={durationSeconds =>
          setProcessing({
            fadeIn: { curve: region.fadeIn.curve, durationSeconds },
            regionId: region.id,
            trackId,
          })
        }
      />
      <RangeControl
        label="Region fade out"
        max={region.duration}
        step={0.01}
        value={region.fadeOut.durationSeconds}
        onChange={durationSeconds =>
          setProcessing({
            fadeOut: { curve: region.fadeOut.curve, durationSeconds },
            regionId: region.id,
            trackId,
          })
        }
      />
      <label className={styles.controlRow}>
        <span className={styles.label}>LAYER</span>
        <input
          aria-label="Region layer"
          className={styles.value}
          min={0}
          step={1}
          type="number"
          value={region.layer}
          onChange={event =>
            void setProcessing({ layer: Number(event.currentTarget.value), regionId: region.id, trackId })
          }
        />
      </label>
      <label className={styles.controlRow}>
        <span className={styles.label}>OPAQUE</span>
        <input
          aria-label="Region opaque"
          checked={region.isOpaque}
          className={styles.checkbox}
          type="checkbox"
          onChange={event =>
            void setProcessing({ isOpaque: event.currentTarget.checked, regionId: region.id, trackId })
          }
        />
      </label>
      <div className={styles.derivedSection} aria-label="Region 파생 처리">
        <DerivedNumberAction
          actionLabel="Time stretch 적용"
          inputLabel="Time stretch 비율"
          max={4}
          min={0.25}
          onAction={() =>
            executeDerivedAction('stretch', {
              type: AudioCommandType.TIME_STRETCH_SELECTED_REGIONS,
              stretchRatio,
            })
          }
          onValueChange={setStretchRatio}
          pending={pendingAction !== null}
          step={0.05}
          value={stretchRatio}
        />
        <DerivedNumberAction
          actionLabel="Pitch shift 적용"
          inputLabel="Pitch shift 반음"
          max={24}
          min={-24}
          onAction={() =>
            executeDerivedAction('pitch', {
              type: AudioCommandType.PITCH_SHIFT_SELECTED_REGIONS,
              semitones: pitchSemitones,
            })
          }
          onValueChange={setPitchSemitones}
          pending={pendingAction !== null}
          step={1}
          value={pitchSemitones}
        />
        <DerivedNumberAction
          actionLabel="Transient 분석"
          inputLabel="Transient 민감도"
          max={1}
          min={0.01}
          onAction={() =>
            executeDerivedAction('transient', {
              type: AudioCommandType.ANALYZE_TRANSIENTS_SELECTED_REGIONS,
              sensitivity: transientSensitivity,
            })
          }
          onValueChange={setTransientSensitivity}
          pending={pendingAction !== null}
          step={0.05}
          value={transientSensitivity}
        />
        <div className={styles.derivedButtons}>
          <button
            aria-label="선택 Region Bounce"
            disabled={pendingAction !== null}
            onClick={() => void executeDerivedAction('bounce', { type: AudioCommandType.BOUNCE_SELECTED_REGIONS })}
            type="button"
          >
            BOUNCE
          </button>
          <button
            aria-label="선택 Region Freeze"
            disabled={pendingAction !== null}
            onClick={() => void executeDerivedAction('freeze', { type: AudioCommandType.FREEZE_SELECTED_REGIONS })}
            type="button"
          >
            FREEZE
          </button>
        </div>
        {pendingAction ? <span className={styles.pendingMessage}>처리 중: {pendingAction}</span> : null}
      </div>
    </div>
  );
}

interface DerivedNumberActionProps {
  readonly actionLabel: string;
  readonly inputLabel: string;
  readonly max: number;
  readonly min: number;
  readonly onAction: () => Promise<void>;
  readonly onValueChange: (value: number) => void;
  readonly pending: boolean;
  readonly step: number;
  readonly value: number;
}

function DerivedNumberAction({
  actionLabel,
  inputLabel,
  max,
  min,
  onAction,
  onValueChange,
  pending,
  step,
  value,
}: DerivedNumberActionProps) {
  return (
    <div className={styles.derivedAction}>
      <label>
        <span>{inputLabel}</span>
        <input
          aria-label={inputLabel}
          max={max}
          min={min}
          onChange={event => onValueChange(Number(event.currentTarget.value))}
          step={step}
          type="number"
          value={value}
        />
      </label>
      <button aria-label={actionLabel} disabled={pending} onClick={() => void onAction()} type="button">
        적용
      </button>
    </div>
  );
}

function RangeControl({
  label,
  max,
  onChange,
  step,
  value,
}: {
  readonly label: string;
  readonly max: number;
  readonly onChange: (value: number) => Promise<unknown>;
  readonly step: number;
  readonly value: number;
}) {
  return (
    <label className={styles.controlRow}>
      <span className={styles.label}>{label.replace('Region ', '').toUpperCase()}</span>
      <input
        aria-label={label}
        max={max}
        min={0}
        step={step}
        type="range"
        value={value}
        onChange={event => void onChange(Number(event.currentTarget.value))}
      />
      <output className={styles.value}>{value.toFixed(2)}</output>
    </label>
  );
}
