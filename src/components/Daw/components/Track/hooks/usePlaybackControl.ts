import { useCallback, useRef } from 'react';
import type { AudioNodes } from '../../../../../logics/audio/audioContextManager';
import { connectAudioNodes } from '../../../../../logics/audio/audioContextManager';
import type { usePlaybackState } from './usePlaybackState';

/**
 * 재생 제어 로직 훅
 * 
 * @param audioContextRef - AudioContext ref
 * @param audioBufferRef - AudioBuffer ref
 * @param nodesRef - 오디오 노드 ref
 * @param playbackState - 재생 상태 관리 훅의 반환값
 * @param onTimeUpdate - 재생 시간 업데이트 콜백
 * @param onPlaybackEnd - 재생 완료 콜백
 * @returns 재생 제어 함수들
 */
export function usePlaybackControl(
  audioContextRef: React.MutableRefObject<AudioContext | null>,
  audioBufferRef: React.MutableRefObject<AudioBuffer | null>,
  nodesRef: React.MutableRefObject<AudioNodes | null>,
  playbackState: ReturnType<typeof usePlaybackState>,
  onTimeUpdate?: (currentTime: number, duration: number) => void,
  onPlaybackEnd?: () => void
) {
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  /**
   * 재생 중지
   */
  const stopPlayback = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch (err) {
        // 이미 정지된 경우 무시
      }
      sourceNodeRef.current = null;
    }
    playbackState.cancelAnimationFrame();
    playbackState.setPlaying(false);
  }, [playbackState]);

  /**
   * 재생 시간 업데이트
   */
  const updateCurrentTime = useCallback(() => {
    if (!playbackState.isPlaying || !audioContextRef.current || !audioBufferRef.current) {
      return;
    }

    const audioContext = audioContextRef.current;
    const audioBuffer = audioBufferRef.current;
    const elapsed =
      audioContext.currentTime -
      playbackState.getStartTime() +
      playbackState.getPausedTime();
    const bufferDuration = audioBuffer.duration;

    if (elapsed >= bufferDuration) {
      // 재생 완료
      stopPlayback();
      playbackState.resetState();
      onTimeUpdate?.(0, bufferDuration);
      onPlaybackEnd?.();
    } else {
      playbackState.setTime(elapsed);
      onTimeUpdate?.(elapsed, bufferDuration);
      playbackState.requestAnimationFrame(updateCurrentTime);
    }
  }, [
    playbackState,
    audioContextRef,
    audioBufferRef,
    stopPlayback,
    onTimeUpdate,
    onPlaybackEnd,
  ]);

  /**
   * 재생 시작
   */
  const startPlayback = useCallback(() => {
    if (!audioContextRef.current || !audioBufferRef.current || !nodesRef.current) {
      return;
    }

    const audioContext = audioContextRef.current;
    const audioBuffer = audioBufferRef.current;
    const nodes = nodesRef.current;

    // AudioContext가 suspended 상태면 resume
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    // 새로운 AudioBufferSourceNode 생성
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    sourceNodeRef.current = source;

    // 오디오 그래프 연결
    connectAudioNodes(source, nodes, audioContext.destination);

    // 재생 시작
    const pausedTime = playbackState.getPausedTime();
    playbackState.recordStartTime(audioContext.currentTime);
    source.start(0, pausedTime);

    // 재생 완료 이벤트
    source.onended = () => {
      stopPlayback();
      playbackState.resetState();
      onTimeUpdate?.(0, audioBuffer.duration);
      onPlaybackEnd?.();
    };

    playbackState.setPlaying(true);
    updateCurrentTime();
  }, [
    audioContextRef,
    audioBufferRef,
    nodesRef,
    playbackState,
    stopPlayback,
    updateCurrentTime,
    onTimeUpdate,
    onPlaybackEnd,
  ]);

  /**
   * 일시정지
   */
  const pausePlayback = useCallback(() => {
    stopPlayback();
    playbackState.recordPausedTime(playbackState.currentTime);
  }, [stopPlayback, playbackState]);

  /**
   * 재생/일시정지 토글
   */
  const togglePlayPause = useCallback(() => {
    if (playbackState.isPlaying) {
      pausePlayback();
    } else {
      startPlayback();
    }
  }, [playbackState.isPlaying, pausePlayback, startPlayback]);

  return {
    togglePlayPause,
    stopPlayback,
    startPlayback,
    pausePlayback,
  };
}
