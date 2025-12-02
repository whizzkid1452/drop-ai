import { useState, useMemo, useEffect } from 'react';
import { AdvancedRuler } from './AdvancedRuler';
import {
  BBTMetric,
  TimecodeMetric,
  SamplesMetric,
  MinSecMetric,
} from './Metric';
import type { TempoMap } from '../../../core/audio/TempoMap';
import { PIXELS_PER_SECOND } from '../../../constants/audio';
import * as styles from './Ruler.css';

/**
 * 룰러 가시성 설정
 */
export interface RulerVisibility {
  bbt: boolean;
  timecode: boolean;
  samples: boolean;
  minsec: boolean;
}

export interface RulerContainerProps {
  tempoMap: TempoMap;
  sampleRate: number;
  timelineDuration: number;
  lower?: number; // 선택적: 스크롤 컨테이너에서 자동 계산
  upper?: number; // 선택적: 스크롤 컨테이너에서 자동 계산
  scrollContainerRef?:
    | React.RefObject<HTMLDivElement | null>
    | React.ForwardedRef<HTMLDivElement>;
  playheadRef?: React.RefObject<HTMLDivElement | null>;
  onRulerClick?: (positionSeconds: number) => void;
  visibility?: Partial<RulerVisibility>;
  onVisibilityChange?: (visibility: RulerVisibility) => void;
}

/**
 * 룰러 컨테이너 - 여러 룰러를 관리
 * Ardour의 editor_rulers.cc를 참고하여 구현
 */
export function RulerContainer({
  tempoMap,
  sampleRate,
  timelineDuration,
  lower: externalLower,
  upper: externalUpper,
  scrollContainerRef,
  playheadRef,
  onRulerClick,
  visibility: externalVisibility,
  onVisibilityChange: _onVisibilityChange,
}: RulerContainerProps) {
  // 내부 가시성 상태 (외부에서 제어하지 않으면 내부에서 관리)
  // TODO: handleVisibilityChange 활성화 시 _setInternalVisibility 사용 필요
  const [internalVisibility, _setInternalVisibility] =
    useState<RulerVisibility>({
      bbt: true,
      timecode: false,
      samples: false,
      minsec: true,
    });

  const visibility = externalVisibility ?? internalVisibility;

  // 뷰포트 범위 계산 (스크롤 위치 기반)
  const [viewRange, setViewRange] = useState<{ lower: number; upper: number }>({
    lower: externalLower ?? 0,
    upper: externalUpper ?? timelineDuration,
  });

  // contentWidth 상태 (전체 컨텐츠 너비)
  const [contentWidth, setContentWidth] = useState<number | null>(null);

  // 스크롤 위치에 따라 뷰포트 범위 업데이트
  useEffect(() => {
    // RefObject 또는 ForwardedRef 처리
    const container =
      scrollContainerRef && 'current' in scrollContainerRef
        ? scrollContainerRef.current
        : null;

    if (!container || externalLower !== undefined) {
      // 외부에서 범위를 제공하거나 스크롤 컨테이너가 없으면 외부 값 사용
      setViewRange({
        lower: externalLower ?? 0,
        upper: externalUpper ?? timelineDuration,
      });
      return;
    }

    const updateRange = () => {
      if (!container) return;

      const scrollLeft = container.scrollLeft;
      const containerWidth = container.clientWidth;
      // contentWidth: 전체 컨텐츠 너비 (Ardour의 canvas width와 유사)
      // 매우 긴 시간 범위에서 마크 개수 계산에 사용
      const scrollWidth = container.scrollWidth;
      setContentWidth(scrollWidth);

      // 픽셀을 초로 변환
      const lowerPx = scrollLeft;
      const upperPx = scrollLeft + containerWidth;

      const lower = Math.max(0, lowerPx / PIXELS_PER_SECOND);
      const upper = Math.min(timelineDuration, upperPx / PIXELS_PER_SECOND);

      setViewRange({ lower, upper });
    };

    updateRange();

    container.addEventListener('scroll', updateRange);
    window.addEventListener('resize', updateRange);

    return () => {
      container.removeEventListener('scroll', updateRange);
      window.removeEventListener('resize', updateRange);
    };
  }, [scrollContainerRef, externalLower, externalUpper, timelineDuration]);

  const { lower, upper } = viewRange;

  // Metric 인스턴스 생성 (메모이제이션)
  const metrics = useMemo(() => {
    return {
      bbt: new BBTMetric(tempoMap, sampleRate),
      timecode: new TimecodeMetric(sampleRate),
      samples: new SamplesMetric(sampleRate),
      minsec: new MinSecMetric(),
    };
  }, [tempoMap, sampleRate]);

  // TODO: 룰러 가시성 변경 핸들러 (미구현)
  // Ardour처럼 룰러 우클릭 메뉴에서 표시/숨김 제어 시 사용
  // 현재는 외부에서 visibility prop으로만 제어 가능
  // 활성화 시 _setInternalVisibility 사용 필요
  // const handleVisibilityChange = useCallback(
  //   (newVisibility: RulerVisibility) => {
  //     if (onVisibilityChange) {
  //       onVisibilityChange(newVisibility);
  //     } else {
  //       _setInternalVisibility(newVisibility);
  //     }
  //   },
  //   [onVisibilityChange]
  // );

  // 룰러 높이 계산
  const rulerHeight = 40;
  let currentY = 0;
  const visibleRulers: Array<{ type: string; y: number }> = [];

  if (visibility.bbt) {
    visibleRulers.push({ type: 'bbt', y: currentY });
    currentY += rulerHeight;
  }
  if (visibility.timecode) {
    visibleRulers.push({ type: 'timecode', y: currentY });
    currentY += rulerHeight;
  }
  if (visibility.samples) {
    visibleRulers.push({ type: 'samples', y: currentY });
    currentY += rulerHeight;
  }
  if (visibility.minsec) {
    visibleRulers.push({ type: 'minsec', y: currentY });
    currentY += rulerHeight;
  }

  const totalHeight = currentY;

  return (
    <div className={styles.rulerContainer}>
      {visibleRulers.map(({ type, y }) => {
        const metric = metrics[type as keyof typeof metrics];
        return (
          <div
            key={type}
            style={{
              position: 'absolute',
              top: `${y}px`,
              left: 0,
              right: 0,
              height: `${rulerHeight}px`,
            }}
          >
            <AdvancedRuler
              type={type as any}
              metric={metric}
              timelineDuration={timelineDuration}
              lower={lower}
              upper={upper}
              contentWidth={contentWidth}
              playheadRef={type === 'bbt' ? playheadRef : undefined}
              onRulerClick={onRulerClick}
              visible={true}
            />
          </div>
        );
      })}
      <div style={{ height: `${totalHeight}px` }} />
    </div>
  );
}
