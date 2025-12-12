import * as styles from '../Track.css';

interface TrackControlsProps {
  index: number;
  isReady: boolean;
  isPlaying: boolean;
  zoomLevel: number;
  volume: number;
  onPlayToggle: () => void;
  onZoomChange: (value: number) => void;
  onVolumeChange: (value: number) => void;
}

export function TrackControls({
  index,
  isReady,
  isPlaying,
  zoomLevel,
  volume,
  onPlayToggle,
  onZoomChange,
  onVolumeChange,
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
        <label className={styles.sliderLabel} htmlFor={`zoom-${index}`}>
          줌
        </label>
        <input
          id={`zoom-${index}`}
          type="range"
          min={0}
          max={200}
          step={10}
          value={zoomLevel}
          onChange={(event) => onZoomChange(Number(event.target.value))}
          className={styles.slider}
        />
      </div>
    </div>
  );
}

