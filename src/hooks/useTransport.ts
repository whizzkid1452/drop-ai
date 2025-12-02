import { useState, useCallback } from 'react';
import type { AudioEngine } from '../core/audio';

/**
 * Transport 컨트롤 훅
 * 재생, 일시정지, 정지, 메트로놈 관리를 담당
 */
export function useTransport(engine: AudioEngine) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);

  const handlePlayPause = useCallback(async () => {
    if (!isPlaying && !isPaused) {
      // 정지 상태에서 재생 시작
      await engine.play();
      setIsPlaying(true);
      setIsPaused(false);
    } else {
      // 재생 중이거나 일시정지 중일 때 일시정지/재개 토글
      await engine.togglePause();
      const transportState = engine.getTransport().isPlayingState();
      setIsPlaying(transportState);
      setIsPaused(!transportState);
    }
  }, [engine, isPlaying, isPaused]);

  const handleStop = useCallback(() => {
    engine.stop();
    setIsPlaying(false);
    setIsPaused(false);
  }, [engine]);

  const handleMetronomeToggle = useCallback(async () => {
    const metronome = engine.getMetronome();
    const newEnabled = !metronomeEnabled;
    await metronome.setEnabled(newEnabled);
    setMetronomeEnabled(newEnabled);
  }, [engine, metronomeEnabled]);

  return {
    isPlaying,
    isPaused,
    metronomeEnabled,
    handlePlayPause,
    handleStop,
    handleMetronomeToggle,
  };
}

