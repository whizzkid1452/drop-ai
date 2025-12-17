import * as styles from '../Track.css';

interface TrackControlsProps {
  index: number;
  isReady: boolean;
  isPlaying: boolean;
  volume: number;
  pan: number;
  onPlayToggle: () => void;
  onVolumeChange: (value: number) => void;
  onPanChange: (value: number) => void;
}

export function TrackControls({
  index,
  isReady,
  isPlaying,
  volume,
  pan,
  onPlayToggle,
  onVolumeChange,
  onPanChange,
}: TrackControlsProps) {
  return (
    <div className={styles.controls}>
      <div className={styles.controlGroup}>
        <button
          className={styles.actionButton}
          onClick={onPlayToggle}
          disabled={!isReady}
        >
          {isPlaying ? '일시정지' : '재생'}
        </button>
      </div>

      <div className={styles.controlGroup}>
        <label className={styles.sliderLabel} htmlFor={`volume-${index}`}>
          볼륨
        </label>
        <input
          id={`volume-${index}`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={volume * 100}
          onChange={(event) => onVolumeChange(Number(event.target.value) / 100)}
          className={styles.slider}
          disabled={!isReady}
        />
        <span className={styles.sliderValue}>{Math.round(volume * 100)}%</span>
      </div>

      <div className={styles.controlGroup}>
        <label className={styles.sliderLabel} htmlFor={`pan-${index}`}>
          패닝
        </label>
        <input
          id={`pan-${index}`}
          type="range"
          min={-100}
          max={100}
          step={1}
          value={pan * 100}
          onChange={(event) => onPanChange(Number(event.target.value) / 100)}
          className={styles.slider}
          disabled={!isReady}
        />
        <span className={styles.sliderValue}>
          {pan === 0 ? '중앙' : pan > 0 ? `R${Math.round(pan * 100)}` : `L${Math.round(Math.abs(pan) * 100)}`}
        </span>
      </div>
    </div>
  );
}

