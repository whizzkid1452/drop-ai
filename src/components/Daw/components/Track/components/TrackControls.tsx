import * as styles from '../Track.css';

interface TrackControlsProps {
  index: number;
  isReady: boolean;
  isPlaying: boolean;
  zoomLevel: number;
  onPlayToggle: () => void;
  onZoomChange: (value: number) => void;
}

export function TrackControls({
  index,
  isReady,
  isPlaying,
  zoomLevel,
  onPlayToggle,
  onZoomChange,
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

