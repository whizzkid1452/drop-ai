import { useRef, useEffect } from 'react';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import { useAudioEngine } from '@/hooks/audio/useAudioEngine';
import * as styles from './Cursor.css';

export const Cursor = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const rAF = useRef<number>(0);
  const audioEngine = useAudioEngine();

  useEffect(() => {
    const updatePosition = (time: number) => {
      if (cursorRef.current) {
        const pps = usePlaybackStore.getState().pixelsPerSecond;
        const x = time * pps;
        cursorRef.current.style.transform = `translateX(${x}px)`;
      }
    };

    const animate = () => {
      const time = audioEngine.getSeconds();
      updatePosition(time);
      rAF.current = requestAnimationFrame(animate);
    };

    const unsubscribe = usePlaybackStore.subscribe(
      ({ isPlaying, currentTime, pixelsPerSecond }, previous) => {
        // Handle Play/Pause State
        if (isPlaying !== previous?.isPlaying) {
          if (isPlaying) {
            /** 재생 직후 시점 */
            rAF.current = requestAnimationFrame(animate);
            return;
          } else {
            /** 종료 직후 시점 */
            cancelAnimationFrame(rAF.current);
            // Sync one last time when pausing to ensure accuracy
            updatePosition(audioEngine.getSeconds());
          }
        }

        /** 수동 제어 시점(정지 시 또는 줌 변경 시) */
        if (
          (!isPlaying && currentTime !== previous?.currentTime) ||
          pixelsPerSecond !== previous?.pixelsPerSecond
        ) {
          updatePosition(currentTime);
        }
      }
    );

    return () => {
      unsubscribe();
      cancelAnimationFrame(rAF.current);
    };
  }, [audioEngine]);

  return <div ref={cursorRef} className={styles.cursor} />;
};
