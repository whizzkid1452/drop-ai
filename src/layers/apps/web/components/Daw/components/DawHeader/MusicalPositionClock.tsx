import { useEffect, useRef } from 'react';
import type { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';
import { usePlaybackClock, useSession } from '@/layers/apps/web/context/layer-hooks';
import * as styles from '../../DawPage.css.ts';
import { formatMusicalPosition } from './format-musical-position';

interface MusicalPositionClockProps {
  readonly coordinateMapper: TimelineCoordinateMapper;
}

export function MusicalPositionClock({ coordinateMapper }: MusicalPositionClockProps) {
  const clockRef = useRef<HTMLOutputElement>(null);
  const animationFrameRef = useRef(0);
  const currentTime = useSession(state => state.currentTime);
  const isPlaying = useSession(state => state.isPlaying);
  const playbackClock = usePlaybackClock();

  useEffect(() => {
    const updateClock = (seconds: number) => {
      // 재생 중 매 frame React tree를 다시 렌더링하지 않고 숫자 표시만 갱신합니다.
      if (clockRef.current) {
        clockRef.current.value = formatMusicalPosition(coordinateMapper.secondsToBBT(seconds));
      }
    };
    const animate = () => {
      updateClock(playbackClock.getCurrentTime());
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    updateClock(isPlaying ? playbackClock.getCurrentTime() : currentTime);
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [coordinateMapper, currentTime, isPlaying, playbackClock]);

  return (
    <output ref={clockRef} className={styles.musicalPositionClock} aria-label="Transport BBT position">
      {formatMusicalPosition(coordinateMapper.secondsToBBT(currentTime))}
    </output>
  );
}
