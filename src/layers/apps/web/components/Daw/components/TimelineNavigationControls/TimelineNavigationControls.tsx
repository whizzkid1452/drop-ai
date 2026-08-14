import { TIMELINE_ZOOM_FOCUS_OPTIONS, type TimelineZoomFocus } from '../../timeline-navigation';
import * as styles from './TimelineNavigationControls.css.ts';

interface TimelineNavigationControlsProps {
  readonly followPlayhead: boolean;
  readonly onFitSession: () => void;
  readonly onFollowPlayheadChange: (follow: boolean) => void;
  readonly onResetZoom: () => void;
  readonly onZoomFocusChange: (focus: TimelineZoomFocus) => void;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly zoomFocus: TimelineZoomFocus;
}

export function TimelineNavigationControls({
  followPlayhead,
  onFitSession,
  onFollowPlayheadChange,
  onResetZoom,
  onZoomFocusChange,
  onZoomIn,
  onZoomOut,
  zoomFocus,
}: TimelineNavigationControlsProps) {
  return (
    <div className={styles.controls} aria-label="Timeline navigation controls">
      <button type="button" className={styles.button} aria-label="Zoom out" onClick={onZoomOut}>
        −
      </button>
      <button type="button" className={styles.button} aria-label="Zoom reset" onClick={onResetZoom}>
        1:1
      </button>
      <button type="button" className={styles.button} aria-label="Zoom in" onClick={onZoomIn}>
        +
      </button>
      <button type="button" className={styles.button} aria-label="Session에 맞춤" onClick={onFitSession}>
        FIT
      </button>
      <select
        className={styles.select}
        aria-label="Zoom 기준점"
        value={zoomFocus}
        onChange={event => onZoomFocusChange(event.target.value as TimelineZoomFocus)}
      >
        {TIMELINE_ZOOM_FOCUS_OPTIONS.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={styles.button}
        aria-label="Playhead 따라가기"
        aria-pressed={followPlayhead}
        onClick={() => onFollowPlayheadChange(!followPlayhead)}
      >
        FOLLOW
      </button>
    </div>
  );
}
