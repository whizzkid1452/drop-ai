import { useMemo } from 'react';
import * as styles from '../TimeRuler.css';
import { formatTime } from '../utils/rulerUtils';

interface UseRulerTicksProps {
  maxDuration: number;
  extraDuration: number;
  pixelsPerSecond: number;
}

export const useRulerTicks = ({ maxDuration, extraDuration, pixelsPerSecond }: UseRulerTicksProps) => {
  return useMemo(() => {
    const tickElements = [];
    const step = 1; // 1 second steps
    const renderDuration = maxDuration + extraDuration;

    for (let i = 0; i <= renderDuration; i += step) {
      const isMajor = i % Math.max(1, Math.floor(60 / pixelsPerSecond)) === 0;

      tickElements.push(
        <div
          key={i}
          className={`${styles.tick} ${isMajor ? styles.majorTick : ''}`}
          style={{ left: `${i * pixelsPerSecond}px` }}
        >
          {isMajor && <span className={styles.label}>{formatTime(i)}</span>}
        </div>
      );
    }
    return tickElements;
  }, [maxDuration, pixelsPerSecond, extraDuration]);
};
