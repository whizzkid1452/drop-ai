import type { CSSProperties } from 'react';
import type { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';
import { getTimelineGridStepQuarterNotes, type TimelineGridDivision } from '../../timeline-grid';
import * as styles from './TimelineGrid.css.ts';

interface TimelineGridProps {
  readonly coordinateMapper: TimelineCoordinateMapper;
  readonly division: TimelineGridDivision;
  readonly isVisible: boolean;
}

export function TimelineGrid({ coordinateMapper, division, isVisible }: TimelineGridProps) {
  if (!isVisible) {
    return null;
  }

  const gridStepQuarterNotes = getTimelineGridStepQuarterNotes({ coordinateMapper, division });
  const gridStepPixels = gridStepQuarterNotes * coordinateMapper.pixelsPerQuarterNote;
  const barPixels =
    coordinateMapper.meterBeatQuarterNotes * coordinateMapper.beatsPerBar * coordinateMapper.pixelsPerQuarterNote;
  const canRenderSubdivision = gridStepPixels >= 4;
  // 첫 layer는 마디, 두 번째 layer는 선택한 grid 간격을 표시합니다.
  const style: CSSProperties = {
    backgroundImage: canRenderSubdivision
      ? 'linear-gradient(to right, rgba(255, 143, 232, 0.16) 1px, transparent 1px), linear-gradient(to right, rgba(255, 255, 255, 0.055) 1px, transparent 1px)'
      : 'linear-gradient(to right, rgba(255, 143, 232, 0.16) 1px, transparent 1px)',
    backgroundSize: canRenderSubdivision ? `${barPixels}px 100%, ${gridStepPixels}px 100%` : `${barPixels}px 100%`,
  };

  return <div className={styles.grid} style={style} aria-hidden="true" />;
}
