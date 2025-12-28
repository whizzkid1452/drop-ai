import { useState } from 'react';
import * as styles from '../Track.css';

interface TrackControlsV2Props {
  onVolumeChange: (volume: number) => void;
  initialVolume: number;
}

export function TrackControlsV2({
  onVolumeChange,
  initialVolume,
}: TrackControlsV2Props) {
  const id = crypto.randomUUID();
  const [volume, setVolume] = useState(initialVolume);

  return (
    <div className={styles.controls}>
      <div className={styles.controlGroup}>
        <label className={styles.sliderLabel} htmlFor={`volume-${id}`}>
          볼륨
        </label>
        <input
          id={`volume-${id}`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={volume * 100}
          onChange={event => {
            onVolumeChange(Number(event.target.value) / 100);
            setVolume(Number(event.target.value) / 100);
          }}
          className={styles.slider}
        />
        <span className={styles.sliderValue}>{Math.round(volume * 100)}%</span>
      </div>
    </div>
  );
}
