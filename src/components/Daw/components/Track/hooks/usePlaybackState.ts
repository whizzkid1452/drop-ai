import { useState, useCallback, useRef } from 'react';

/**
 * 오디오 재생 상태 관리 훅
 * 
 * @returns 재생 상태 및 상태 업데이트 함수들
 */
export function usePlaybackState() {
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  
  /**
   * 현재 재생 중인 실제 시간을 계산하는 함수
   * AudioContext의 currentTime을 기반으로 정확한 재생 시간을 반환
   */
  const calculateCurrentPlaybackTime = useCallback((audioContextCurrentTime: number): number => {
    if (startTimeRef.current === 0) {
      return pausedTimeRef.current;
    }
    return audioContextCurrentTime - startTimeRef.current + pausedTimeRef.current;
  }, []);

  /**
   * 재생 상태 초기화
   */
  const resetState = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    pausedTimeRef.current = 0;
    startTimeRef.current = 0;
  }, []);

  /**
   * 오디오 준비 완료 상태 설정
   */
  const setReady = useCallback((ready: boolean) => {
    setIsReady(ready);
  }, []);

  /**
   * 재생 시간 설정
   */
  const setTime = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  /**
   * 재생 시작 시간 기록
   */
  const recordStartTime = useCallback((time: number) => {
    startTimeRef.current = time;
  }, []);

  /**
   * 일시정지 시간 기록
   */
  const recordPausedTime = useCallback((time: number) => {
    pausedTimeRef.current = time;
  }, []);

  /**
   * 일시정지 시간 가져오기
   */
  const getPausedTime = useCallback(() => {
    return pausedTimeRef.current;
  }, []);

  /**
   * 재생 시작 시간 가져오기
   */
  const getStartTime = useCallback(() => {
    return startTimeRef.current;
  }, []);

  /**
   * 애니메이션 프레임 요청
   */
  const requestAnimationFrame = useCallback((callback: () => void) => {
    animationFrameRef.current = window.requestAnimationFrame(callback);
  }, []);

  /**
   * 애니메이션 프레임 취소
   */
  const cancelAnimationFrame = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  /**
   * 재생 상태 설정
   */
  const setPlaying = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  /**
   * 오디오 길이 설정
   */
  const setAudioDuration = useCallback((dur: number) => {
    setDuration(dur);
  }, []);

  return {
    // 상태
    isReady,
    isPlaying,
    currentTime,
    duration,
    
    // 상태 업데이트 함수
    setReady,
    setPlaying,
    setTime,
    setAudioDuration,
    resetState,
    
    // 시간 관리
    recordStartTime,
    recordPausedTime,
    getPausedTime,
    getStartTime,
    
    // 애니메이션 프레임 관리
    requestAnimationFrame,
    cancelAnimationFrame,
    
    // 시간 계산
    calculateCurrentPlaybackTime,
  };
}
