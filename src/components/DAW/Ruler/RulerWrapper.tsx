import { forwardRef, useMemo } from 'react';
import {
  DEFAULT_TIMELINE_DURATION,
  PIXELS_PER_SECOND,
} from '../../../constants/audio';
import { RulerContainer } from './RulerContainer';
import type { RulerWrapperProps } from '../../../types/daw';
import type { AudioEngine } from '../../../core/audio';
import * as styles from './RulerWrapper.css';

/**
 * 룰러 래퍼 컴포넌트 (Ardour 스타일)
 * - 고급 룰러 컨테이너 사용 (RulerContainer)
 * - 스크롤 동기화를 위한 ref 제공
 */
export interface AdvancedRulerWrapperProps extends RulerWrapperProps {
  engine?: AudioEngine;
}

export const RulerWrapper = forwardRef<
  HTMLDivElement,
  AdvancedRulerWrapperProps
>(({ playheadRef, timelineDuration, onRulerClick, engine }, ref) => {
  const contentWidthPx = Math.ceil(
    (timelineDuration ?? DEFAULT_TIMELINE_DURATION) * PIXELS_PER_SECOND
  );

  // TempoMap과 샘플레이트 가져오기
  const tempoMapAndSampleRate = useMemo(() => {
    if (engine) {
      const transport = engine.getTransport();
      const tempoMap = transport.getTempoMap();
      const sampleRate = engine.getAudioContext().sampleRate;
      return { tempoMap, sampleRate };
    }
    return { tempoMap: null, sampleRate: 44100 };
  }, [engine]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.spacer} />
      <div className={styles.scrollContainer} ref={ref}>
        <div
          style={{
            width: `${contentWidthPx}px`,
            minWidth: `${contentWidthPx}px`,
          }}
        >
          {tempoMapAndSampleRate.tempoMap ? (
            <RulerContainer
              tempoMap={tempoMapAndSampleRate.tempoMap}
              sampleRate={tempoMapAndSampleRate.sampleRate}
              timelineDuration={timelineDuration ?? DEFAULT_TIMELINE_DURATION}
              scrollContainerRef={ref}
              playheadRef={playheadRef}
              onRulerClick={onRulerClick}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
});

RulerWrapper.displayName = 'RulerWrapper';
