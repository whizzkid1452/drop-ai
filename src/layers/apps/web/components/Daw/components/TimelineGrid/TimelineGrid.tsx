import type { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';
import { createTimelineGridLines, type TimelineGridDivision } from '../../timeline-grid';
import * as styles from './TimelineGrid.css.ts';

interface TimelineGridProps {
  readonly coordinateMapper: TimelineCoordinateMapper;
  readonly division: TimelineGridDivision;
  readonly isVisible: boolean;
  readonly timelineContentWidth: number;
}

export function TimelineGrid({ coordinateMapper, division, isVisible, timelineContentWidth }: TimelineGridProps) {
  if (!isVisible) {
    return null;
  }

  const lines = createTimelineGridLines({
    coordinateMapper,
    division,
    endQuarterNotes: timelineContentWidth / coordinateMapper.pixelsPerQuarterNote,
  });

  return (
    <div className={styles.grid} aria-hidden="true">
      {lines.map(line => (
        <span
          key={line.quarterNotePosition}
          className={line.level === 'bar' ? styles.barLine : styles.divisionLine}
          style={{ left: `${line.pixel}px` }}
        />
      ))}
    </div>
  );
}
