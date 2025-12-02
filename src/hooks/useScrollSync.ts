import { useEffect, useRef } from 'react';

export interface ScrollSyncOptions<T extends HTMLElement> {
  rulerRef?: React.RefObject<T | null>;
  timelineRefs?: React.MutableRefObject<Map<number, T | null>>;
  bottomScrollRef?: React.RefObject<T | null>;
  trackCount?: number;
}

/**
 * 여러 스크롤 요소를 동기화하는 훅
 * @param options 스크롤 동기화 옵션
 */
export function useScrollSync<T extends HTMLElement>(
  options: ScrollSyncOptions<T>
) {
  const { rulerRef, timelineRefs, bottomScrollRef, trackCount = 0 } = options;

  const isSyncingRef = useRef(false);

  useEffect(() => {
    const handleScroll = (scrollLeft: number, sourceElement: HTMLElement) => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;

      // 룰러 스크롤 동기화
      if (rulerRef?.current && rulerRef.current !== sourceElement) {
        rulerRef.current.scrollLeft = scrollLeft;
      }

      // 타임라인 스크롤 동기화
      if (timelineRefs) {
        timelineRefs.current.forEach(otherElement => {
          if (otherElement && otherElement !== sourceElement) {
            otherElement.scrollLeft = scrollLeft;
          }
        });
      }

      // 하단 스크롤바 동기화
      if (
        bottomScrollRef?.current &&
        bottomScrollRef.current !== sourceElement
      ) {
        bottomScrollRef.current.scrollLeft = scrollLeft;
      }

      requestAnimationFrame(() => {
        isSyncingRef.current = false;
      });
    };

    const cleanupFunctions: Array<() => void> = [];

    // 타임라인 스크롤 리스너 등록
    if (timelineRefs) {
      timelineRefs.current.forEach(element => {
        if (!element) return;

        const handleTimelineScroll = () => {
          if (element) {
            handleScroll(element.scrollLeft, element);
          }
        };

        element.addEventListener('scroll', handleTimelineScroll, {
          passive: true,
        });
        cleanupFunctions.push(() => {
          element.removeEventListener('scroll', handleTimelineScroll);
        });
      });
    }

    // 룰러 스크롤 리스너 등록
    const rulerElement = rulerRef?.current;
    if (rulerElement) {
      const handleRulerScroll = () => {
        handleScroll(rulerElement.scrollLeft, rulerElement);
      };

      rulerElement.addEventListener('scroll', handleRulerScroll, {
        passive: true,
      });
      cleanupFunctions.push(() => {
        rulerElement.removeEventListener('scroll', handleRulerScroll);
      });
    }

    // 하단 스크롤바 리스너 등록
    const bottomElement = bottomScrollRef?.current;
    if (bottomElement) {
      const handleBottomScroll = () => {
        handleScroll(bottomElement.scrollLeft, bottomElement);
      };

      bottomElement.addEventListener('scroll', handleBottomScroll, {
        passive: true,
      });
      cleanupFunctions.push(() => {
        bottomElement.removeEventListener('scroll', handleBottomScroll);
      });
    }

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [trackCount, rulerRef, timelineRefs, bottomScrollRef]);
}
