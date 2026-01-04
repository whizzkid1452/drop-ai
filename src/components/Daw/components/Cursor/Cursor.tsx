import { useRef, useEffect } from 'react';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import { PIXELS_PER_SECOND } from '@/constants/dawConstants';
import * as styles from './Cursor.css';

export const Cursor = () => {
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Direct subscription to avoid re-renders
    const unsubscribe = usePlaybackStore.subscribe(state => {
      const time = state.currentTime;
      if (cursorRef.current) {
        const x = time * PIXELS_PER_SECOND;
        cursorRef.current.style.transform = `translateX(${x}px)`;
      }
    });

    return () => unsubscribe();
  }, []); // Run only once on mount

  return <div ref={cursorRef} className={styles.cursor} />;
};
