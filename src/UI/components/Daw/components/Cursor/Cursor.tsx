import { useRef, useEffect } from 'react';
import { useAudioService, useAudioServiceActions } from '@/AudioEngine/FACADE/useAudioEngineFacade';
import * as styles from './Cursor.css';

export const Cursor = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const rAF = useRef<number>(0);
  const { isPlaying, currentTime, pixelsPerSecond } = useAudioService();
  const { getCurrentTime } = useAudioServiceActions();

  useEffect(() => {
    const updatePosition = (time: number) => {
      if (cursorRef.current) {
        const x = time * pixelsPerSecond;
        cursorRef.current.style.transform = `translateX(${x}px)`;
      }
    };

    const animate = () => {
      const time = getCurrentTime();
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
  }, [isPlaying, currentTime, pixelsPerSecond, getCurrentTime]);

  return <div ref={cursorRef} className={styles.cursor} />;
};
