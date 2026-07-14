import * as styles from '../Track.css.ts';

interface TrackVolumeControllerProps {
  onVolumeChange: (volume: number) => void;
  volume: number;
}

export function TrackVolumeController({ onVolumeChange, volume }: TrackVolumeControllerProps) {
  const id = crypto.randomUUID();
  return (
    <div className={styles.controls}>
      <div className={styles.controlGroup}>
        <label className={styles.sliderLabel} htmlFor={`volume-${id}`}>
          Volume
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
          }}
          className={styles.slider}
        />
        <span className={styles.sliderValue}>{Math.round(volume * 100)}%</span>
      </div>
    </div>
  );
}
