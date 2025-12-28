import { useMemo, useState } from 'react';
import * as styles from '../Track.css';

interface TrackPanControllerProps {
  onPanChange: (volume: number) => void;
  initialPan: number;
}

export function TrackPanController({
  onPanChange: onPanChange,
  initialPan,
}: TrackPanControllerProps) {
  const id = crypto.randomUUID();
  const [pan, setPan] = useState(initialPan);

  const sliderValue = useMemo(() => {
    if (pan === -1) {
      return 'Left';
    }
    if (pan === 1) {
      return 'Right';
    }
    if (pan === 0) {
      return 'Center';
    }
    return `${Math.round(pan * 100)}%`;
  }, [pan]);

  return (
    <div className={styles.controls}>
      <div className={styles.controlGroup}>
        <label className={styles.sliderLabel} htmlFor={`volume-${id}`}>
          Pan
        </label>
        <input
          id={`volume-${id}`}
          type="range"
          min={-100}
          max={100}
          step={1}
          value={pan * 100}
          onChange={event => {
            onPanChange(Number(event.target.value) / 100);
            setPan(Number(event.target.value) / 100);
          }}
          className={styles.slider}
        />
        <span className={styles.sliderValue}>{sliderValue}</span>
      </div>
    </div>
  );
}
