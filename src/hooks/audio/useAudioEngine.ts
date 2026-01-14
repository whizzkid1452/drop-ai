import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AudioEngine } from '@/logics/audio/audioEngine';
import type { AudioEngineDependencies } from '@/logics/audio/audioEngine.types';
import { useTrackStore } from '@/stores/useTrackStore';
import { usePlaybackStore } from '@/stores/usePlaybackStore';

/**
 * AudioEngine Hook
 * 
 * 목적:
 * - AudioEngine에 필요한 의존성 생성
 * - Store와 AudioEngine 연결
 * - 의존성 주입 패턴 적용
 * 
 * 장점:
 * - AudioEngine이 Store를 직접 알지 못함
 * - 테스트 시 Mock 의존성으로 대체 가능
 * - 관심사 분리 (비즈니스 로직 vs UI 상태)
 * 
 * @returns AudioEngine 인스턴스
 * 
 * @example
 * ```tsx
 * function DawPage() {
 *   const audioEngine = useAudioEngine();
 *   
 *   const handlePlay = () => {
 *     audioEngine.execute({ type: 'PLAY' });
 *   };
 *   
 *   return <button onClick={handlePlay}>재생</button>;
 * }
 * ```
 */
export function useAudioEngine(): AudioEngine {
  // Store에서 필요한 함수만 가져오기
  const { tracks, updateTrack } = useTrackStore(
    useShallow(state => ({
      tracks: state.tracks,
      updateTrack: state.updateTrack,
    }))
  );

  const { setIsPlaying, setCurrentTime, setExportRange, exportStartTime, exportEndTime } = usePlaybackStore(
    useShallow(state => ({
      setIsPlaying: state.setIsPlaying,
      setCurrentTime: state.setCurrentTime,
      setExportRange: state.setExportRange,
      exportStartTime: state.exportStartTime,
      exportEndTime: state.exportEndTime,
    }))
  );

  /**
   * AudioEngine 의존성 생성
   * 
   * useMemo로 메모이제이션하여 불필요한 재생성 방지
   */
  const dependencies = useMemo<AudioEngineDependencies>(() => ({
    /**
     * 현재 프로젝트의 모든 트랙 가져오기
     */
    getTracks: () => {
      return Array.from(tracks.values());
    },

    /**
     * Export 범위 가져오기
     */
    getExportRange: () => {
      if (exportStartTime === null || exportEndTime === null) {
        return null;
      }
      return { startTime: exportStartTime, endTime: exportEndTime };
    },

    /**
     * 트랙 업데이트 (UI 동기화)
     */
    updateTrack: (trackId, update) => {
      updateTrack({
        trackId,
        updater: track => ({ ...track, ...update }),
      });
    },

    /**
     * 재생 상태 업데이트 (UI 동기화)
     */
    updatePlaybackState: (state) => {
      if (state.isPlaying !== undefined) {
        setIsPlaying(state.isPlaying);
      }
      if (state.currentTime !== undefined) {
        setCurrentTime(state.currentTime);
      }
    },

    /**
     * Export 범위 설정
     */
    setExportRange: (startTime, endTime) => {
      setExportRange(startTime, endTime);
    },
  }), [
    tracks,
    exportStartTime,
    exportEndTime,
    updateTrack,
    setIsPlaying,
    setCurrentTime,
    setExportRange,
  ]);

  /**
   * AudioEngine 인스턴스 생성
   * 
   * 의존성이 변경될 때만 재생성
   * (실제로는 거의 재생성되지 않음)
   */
  const audioEngine = useMemo(
    () => new AudioEngine(dependencies),
    [dependencies]
  );

  return audioEngine;
}
