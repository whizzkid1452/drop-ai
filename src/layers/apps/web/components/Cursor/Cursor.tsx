import { useRef, useEffect, type RefObject } from 'react';
import { usePlaybackClock, useSession } from '@/layers/apps/web/context/layer-hooks';
import * as styles from './Cursor.css.ts';
import type { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';

interface CursorProps {
  coordinateMapper: TimelineCoordinateMapper;
  timelineViewportRef: RefObject<HTMLElement | null>;
}

export const Cursor = ({ coordinateMapper, timelineViewportRef }: CursorProps) => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const rAF = useRef<number>(0);
  const isPlaying = useSession(state => state.isPlaying);
  const currentTime = useSession(state => state.currentTime);
  const playbackClock = usePlaybackClock();

  useEffect(() => {
    const updatePosition = (time: number) => {
      if (cursorRef.current) {
        const x = coordinateMapper.secondsToPixels(time);
        cursorRef.current.style.transform = `translateX(${x}px)`;
        // 고정 Track 헤더 열로 이동한 플레이헤드는 스크롤 콘텐츠 위에 겹치지 않도록 숨긴다.
        cursorRef.current.style.visibility = x < (timelineViewportRef.current?.scrollLeft ?? 0) ? 'hidden' : 'visible';
      }
    };

    const animate = () => {
      const time = playbackClock.getCurrentTime();
      updatePosition(time);
      rAF.current = requestAnimationFrame(animate);
    };

    const handleViewportScroll = () => {
      updatePosition(isPlaying ? playbackClock.getCurrentTime() : currentTime);
    };

    const timelineViewport = timelineViewportRef.current;
    timelineViewport?.addEventListener('scroll', handleViewportScroll);

    // Start/stop animation based on isPlaying state
    if (isPlaying) {
      rAF.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(rAF.current);
      // Update to current position when not playing
      updatePosition(currentTime);
    }

    return () => {
      cancelAnimationFrame(rAF.current);
      timelineViewport?.removeEventListener('scroll', handleViewportScroll);
    };
  }, [coordinateMapper, isPlaying, currentTime, playbackClock, timelineViewportRef]);

  return <div ref={cursorRef} className={styles.cursor} />;
};
