import { useEffect } from 'react';
import * as Tone from 'tone';
import { usePlaybackStore } from '@/stores/usePlaybackStore';

/**
 * Synchronizes Tone.Transport (Audio Truth) with UI State (Visual Truth)
 * 
 * Architecture:
 * - Audio Truth: Tone.Transport.position (actual audio time)
 * - Visual Truth: Zustand Store (UI display time)
 * 
 * This hook bridges the gap by:
 * 1. Reading Tone.Transport.seconds every frame (when playing)
 * 2. Updating Zustand store via setCurrentTime
 * 3. Using Tone.Draw.schedule for sync with requestAnimationFrame
 * 
 * Performance:
 * - Only runs when isPlaying = true
 * - Uses RAF (60fps) instead of setInterval
 * - Minimal React re-renders (only currentTime state changes)
 * 
 * @see docs/refactor-plan.md - "이중 상태 아키텍처 (Dual-State Architecture)"
 */
export function useToneTransportSync() {
  const setCurrentTime = usePlaybackStore(state => state.setCurrentTime);
  const isPlaying = usePlaybackStore(state => state.isPlaying);

  useEffect(() => {
    if (!isPlaying) {
      // When paused/stopped, sync once to ensure UI matches Transport
      const seconds = Tone.getTransport().seconds;
      setCurrentTime(seconds);
      return;
    }

    let rafId: number;
    let isRunning = true;

    const updateTime = () => {
      if (!isRunning) return;

      // Use Tone.Draw.schedule to sync with Tone.js's internal clock
      Tone.Draw.schedule(() => {
        const seconds = Tone.getTransport().seconds;
        setCurrentTime(seconds);
      }, Tone.now());

      rafId = requestAnimationFrame(updateTime);
    };

    rafId = requestAnimationFrame(updateTime);

    return () => {
      isRunning = false;
      cancelAnimationFrame(rafId);
    };
  }, [isPlaying, setCurrentTime]);
}

