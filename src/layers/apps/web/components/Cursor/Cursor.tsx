import { useRef, useEffect } from 'react';
import { usePlaybackClock, useSession } from '@/layers/apps/web/context/layer-hooks';
import * as styles from './Cursor.css.ts';

interface CursorProps {
  pixelsPerSecond: number;
}

export const Cursor = ({ pixelsPerSecond }: CursorProps) => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const rAF = useRef<number>(0);
  const isPlaying = useSession(state => state.isPlaying);
  const currentTime = useSession(state => state.currentTime);
  const playbackClock = usePlaybackClock();

  useEffect(() => {
    const updatePosition = (time: number) => {
      if (cursorRef.current) {
        const x = time * pixelsPerSecond;
        cursorRef.current.style.transform = `translateX(${x}px)`;
      }
    };

    const animate = () => {
      const time = playbackClock.getCurrentTime();
      updatePosition(time);
      rAF.current = requestAnimationFrame(animate);
    };

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
    };
  }, [isPlaying, currentTime, pixelsPerSecond, playbackClock]);

  return <div ref={cursorRef} className={styles.cursor} />;
};
