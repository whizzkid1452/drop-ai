import { useCallback } from 'react';
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
