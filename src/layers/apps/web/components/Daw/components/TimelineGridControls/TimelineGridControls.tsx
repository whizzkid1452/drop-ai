import type { TimelineGridDivision, TimelineSnapMode } from '../../timeline-grid';
import * as styles from './TimelineGridControls.css.ts';

interface TimelineGridControlsProps {
  readonly division: TimelineGridDivision;
  readonly isGridVisible: boolean;
  readonly onDivisionChange: (division: TimelineGridDivision) => void;
  readonly onGridVisibleChange: (isVisible: boolean) => void;
  readonly onSnapModeChange: (mode: TimelineSnapMode) => void;
  readonly snapMode: TimelineSnapMode;
}

export function TimelineGridControls({
  division,
  isGridVisible,
  onDivisionChange,
  onGridVisibleChange,
  onSnapModeChange,
  snapMode,
}: TimelineGridControlsProps) {
  return (
    <div className={styles.controls} aria-label="Timeline grid controls">
      <button
        type="button"
        className={styles.toggle}
        aria-label="Grid 표시"
        aria-pressed={isGridVisible}
        onClick={() => onGridVisibleChange(!isGridVisible)}
      >
        GRID
      </button>
      <select
        className={styles.select}
        aria-label="Grid 간격"
        value={division}
        onChange={event => onDivisionChange(event.target.value as TimelineGridDivision)}
      >
        <option value="bar">Bar</option>
        <option value="beat">Beat</option>
        <option value="halfBeat">1/2 Beat</option>
        <option value="quarterBeat">1/4 Beat</option>
        <option value="eighthBeat">1/8 Beat</option>
        <option value="sixteenthBeat">1/16 Beat</option>
      </select>
      <select
        className={styles.select}
        aria-label="Snap 모드"
        value={snapMode}
        onChange={event => onSnapModeChange(event.target.value as TimelineSnapMode)}
      >
        <option value="off">Snap Off</option>
        <option value="grid">Snap Grid</option>
        <option value="magnetic">Snap Magnetic</option>
      </select>
    </div>
  );
}
