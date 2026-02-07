import { useRef, useEffect } from 'react';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import { AudioService } from '@/FACADE/Facade';
import { useAudioService } from '@/FACADE/useFacade';
import * as styles from './Cursor.css';

export const Cursor = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const rAF = useRef<number>(0);
  const { isPlaying, currentTime } = useAudioService();
  const pixelsPerSecond = usePlaybackStore(state => state.pixelsPerSecond);

  useEffect(() => {
    const updatePosition = (time: number) => {
      if (cursorRef.current) {
        const x = time * pixelsPerSecond;
        cursorRef.current.style.transform = `translateX(${x}px)`;
      }
    };

    const animate = () => {
      const time = AudioService.getInstance().getCurrentTime();
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
  }, [isPlaying, currentTime, pixelsPerSecond]);

  return <div ref={cursorRef} className={styles.cursor} />;
};
