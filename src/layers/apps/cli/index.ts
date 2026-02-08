import { useState, useCallback } from 'react';
import { useController, useSession } from '../../presentation/context/LayerContext';

/**
 * CLI App Presentation Logic Hook
 */
export const useCliApp = () => {
  const controller = useController();
  
  // 상태 구독
  const isPlaying = useSession(state => state.isPlaying);
  const trackCount = useSession(state => state.tracks.size);
  
  // CLI 특화 로직 (로그 관리)
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${msg}`, ...prev]);
  }, []);

  // 비즈니스 액션 시퀀스 정의
  const play = async () => {
    addLog('Requesting Play...');
    await controller.playback.handlePlay();
    addLog(`Session Action: Play command executed`);
  };

  const stop = () => {
    addLog('Requesting Stop...');
    controller.playback.handleStop();
    addLog(`Session Action: Stop command executed`);
  };

  const addTrack = async () => {
    const id = `track-${Math.random().toString(36).substr(2, 5)}`;
    addLog(`Adding track: ${id}`);
    await controller.track.addTrack('mock-url', id);
    addLog(`Session Action: Track ${id} added`);
  };

  return {
    isPlaying,
    trackCount,
    logs,
    play,
    stop,
    addTrack
  };
};
