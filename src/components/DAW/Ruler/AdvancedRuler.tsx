import { useMemo, useCallback, useRef, useEffect } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { PIXELS_PER_SECOND } from '../../../constants/audio';
import type { Metric } from './Metric';
import * as styles from './Ruler.css';

/**
 * 룰러 타입
 */
export type RulerType = 'bbt' | 'timecode' | 'samples' | 'minsec';

export interface AdvancedRulerProps {
  type: RulerType;
  metric: Metric;
  timelineDuration: number;
  lower: number; // 표시할 하한 (초)
  upper: number; // 표시할 상한 (초)
  contentWidth?: number | null; // 전체 컨텐츠 너비 (Ardour의 canvas width와 유사)
  playheadRef?: React.RefObject<HTMLDivElement | null>;
  onRulerClick?: (positionSeconds: number) => void;
  visible?: boolean;
}

/**
 * 고급 룰러 컴포넌트 (Ardour 스타일)
 * Metric 패턴을 사용하여 다양한 시간 표시 방식 지원
 */
export function AdvancedRuler({
  type,
  metric,
  timelineDuration,
  lower,
  upper,
  contentWidth,
  playheadRef,
  onRulerClick,
  visible = true,
}: AdvancedRulerProps) {
  const rulerContentRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);

  // unitsPerPixel 업데이트
  useEffect(() => {
    metric.unitsPerPixel = 1 / PIXELS_PER_SECOND;
  }, [metric]);

  // 마크 계산
  const marks = useMemo(() => {
    if (!visible) return [];
    return metric.getMarks(lower, upper, 50, contentWidth ?? undefined);
  }, [metric, lower, upper, visible, contentWidth]);

  const getScrollLeft = useCallback((target: HTMLElement) => {
    let scrollLeft = 0;
    let currentElement: HTMLElement | null = target.parentElement;

    while (currentElement) {
      if (
        currentElement.scrollWidth > currentElement.clientWidth ||
        currentElement.scrollLeft > 0
      ) {
        scrollLeft = currentElement.scrollLeft;
        break;
      }
      currentElement = currentElement.parentElement;
    }

    return scrollLeft;
  }, []);

  const computePositionFromClientX = useCallback(
    (clientX: number) => {
      const rulerContent = rulerContentRef.current;
      if (!rulerContent) return null;

      const rect = rulerContent.getBoundingClientRect();
      const offsetX = clientX - rect.left;
      const scrollLeft = getScrollLeft(rulerContent);
      const totalX = Math.max(0, offsetX + scrollLeft);
      const positionSeconds = totalX / PIXELS_PER_SECOND;
      return Math.max(0, Math.min(positionSeconds, timelineDuration));
    },
    [getScrollLeft, timelineDuration]
  );

  const updatePositionFromClientX = useCallback(
    (clientX: number) => {
      if (!onRulerClick) return;
      const positionSeconds = computePositionFromClientX(clientX);
      if (positionSeconds === null) return;
      onRulerClick(positionSeconds);
    },
    [computePositionFromClientX, onRulerClick]
  );

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!isDraggingRef.current) return;
      event.preventDefault();
      updatePositionFromClientX(event.clientX);
    },
    [updatePositionFromClientX]
  );

  const handleMouseUp = useCallback(
    (event: MouseEvent) => {
      if (!isDraggingRef.current) return;
      event.preventDefault();
      updatePositionFromClientX(event.clientX);
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    },
    [handleMouseMove, updatePositionFromClientX]
  );

  const handleMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!onRulerClick) return;
      event.preventDefault();
      isDraggingRef.current = true;
      updatePositionFromClientX(event.clientX);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [handleMouseMove, handleMouseUp, onRulerClick, updatePositionFromClientX]
  );

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  if (!visible) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div
        className={styles.rulerContent}
        ref={rulerContentRef}
        onMouseDown={handleMouseDown}
        data-ruler-type={type}
      >
        {marks.map((mark, index) => {
          const leftPercent = (mark.position / timelineDuration) * 100;

          return (
            <div
              key={`${type}-${mark.position}-${index}`}
              className={
                mark.style === 'major'
                  ? styles.barMarker
                  : mark.style === 'minor'
                    ? styles.beatMarker
                    : styles.microMarker
              }
              style={{ left: `${leftPercent}%` }}
            >
              {mark.label && (
                <span
                  className={
                    mark.style === 'major'
                      ? styles.barNumber
                      : styles.minorLabel
                  }
                >
                  {mark.label}
                </span>
              )}
            </div>
          );
        })}
        {playheadRef && (
          <div
            className={styles.playhead}
            ref={playheadRef}
            style={{ left: '0%', opacity: 0, display: 'none' }}
          />
        )}
      </div>
    </div>
  );
}
