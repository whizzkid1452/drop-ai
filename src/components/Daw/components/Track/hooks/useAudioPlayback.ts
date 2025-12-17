import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Web Audio API를 사용한 오디오 재생 관리 훅
 * 
 * @param audioUrl - 재생할 오디오 파일 URL
 * @param volume - 볼륨 레벨 (0.0 ~ 1.0)
 * @param pan - 패닝 레벨 (-1.0 ~ 1.0)
 * @param onTimeUpdate - 재생 시간 업데이트 콜백
 * @param onPlaybackEnd - 재생 완료 콜백
 * @returns 재생 상태 및 제어 함수들
 */
export function useAudioPlayback(
  audioUrl: string,
  volume: number,
  pan: number,
  onTimeUpdate?: (currentTime: number, duration: number) => void,
  onPlaybackEnd?: () => void
) {
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Web Audio API 관련 refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const pannerNodeRef = useRef<StereoPannerNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  // 재생 중지 함수
  const stopPlayback = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch (err) {
        // 이미 정지된 경우 무시
      }
      sourceNodeRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  // Web Audio API 초기화 및 오디오 로드
  useEffect(() => {
    let isMounted = true;

    const initAudio = async () => {
      try {
        // AudioContext 생성
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;

        // 오디오 파일 로드 및 디코딩
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        if (!isMounted) return;
        
        audioBufferRef.current = audioBuffer;
        setDuration(audioBuffer.duration);

        // GainNode 생성 (볼륨 제어)
        const gainNode = audioContext.createGain();
        gainNode.gain.value = volume;
        gainNodeRef.current = gainNode;

        // StereoPannerNode 생성 (패닝 제어)
        const panner = audioContext.createStereoPanner();
        panner.pan.value = pan;
        pannerNodeRef.current = panner;

        setIsReady(true);
      } catch (err) {
        console.error('오디오 초기화 실패:', err);
        setIsReady(false);
      }
    };

    initAudio();

    return () => {
      isMounted = false;
      // 리소스 정리
      stopPlayback();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;
      audioBufferRef.current = null;
      gainNodeRef.current = null;
      pannerNodeRef.current = null;
    };
  }, [audioUrl, stopPlayback]);

  // 재생 시간 업데이트 함수
  const updateCurrentTime = useCallback(() => {
    if (!isPlaying || !audioContextRef.current || !audioBufferRef.current) {
      return;
    }

    const elapsed = audioContextRef.current.currentTime - startTimeRef.current + pausedTimeRef.current;
    const bufferDuration = audioBufferRef.current.duration;
    
    if (elapsed >= bufferDuration) {
      // 재생 완료
      stopPlayback();
      setCurrentTime(0);
      pausedTimeRef.current = 0;
      onTimeUpdate?.(0, bufferDuration);
      onPlaybackEnd?.();
    } else {
      setCurrentTime(elapsed);
      onTimeUpdate?.(elapsed, bufferDuration);
      animationFrameRef.current = requestAnimationFrame(updateCurrentTime);
    }
  }, [isPlaying, stopPlayback, onTimeUpdate, onPlaybackEnd]);

  // 재생/일시정지 토글
  const togglePlayPause = useCallback(() => {
    if (!isReady || !audioContextRef.current || !audioBufferRef.current) return;

    if (isPlaying) {
      // 일시정지
      stopPlayback();
      pausedTimeRef.current = currentTime;
    } else {
      // 재생 시작
      const audioContext = audioContextRef.current;
      const audioBuffer = audioBufferRef.current;

      // AudioContext가 suspended 상태면 resume
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      // 새로운 AudioBufferSourceNode 생성
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      sourceNodeRef.current = source;

      // 오디오 그래프 연결: source -> gain -> panner -> destination
      source.connect(gainNodeRef.current!);
      gainNodeRef.current!.connect(pannerNodeRef.current!);
      pannerNodeRef.current!.connect(audioContext.destination);

      // 재생 시작
      startTimeRef.current = audioContext.currentTime;
      source.start(0, pausedTimeRef.current);

      // 재생 완료 이벤트
      source.onended = () => {
        stopPlayback();
        setCurrentTime(0);
        pausedTimeRef.current = 0;
        onTimeUpdate?.(0, audioBuffer.duration);
        onPlaybackEnd?.();
      };

      setIsPlaying(true);
      updateCurrentTime();
    }
  }, [isReady, isPlaying, currentTime, stopPlayback, updateCurrentTime, onTimeUpdate, onPlaybackEnd]);

  // 볼륨 변경 시 GainNode에 적용
  useEffect(() => {
    if (gainNodeRef.current && audioContextRef.current) {
      const clampedValue = Math.max(0, Math.min(1, volume));
      gainNodeRef.current.gain.setValueAtTime(
        clampedValue,
        audioContextRef.current.currentTime
      );
    }
  }, [volume]);

  // 패닝 변경 시 StereoPannerNode에 적용
  useEffect(() => {
    if (pannerNodeRef.current && audioContextRef.current) {
      const clampedValue = Math.max(-1, Math.min(1, pan));
      pannerNodeRef.current.pan.setValueAtTime(
        clampedValue,
        audioContextRef.current.currentTime
      );
    }
  }, [pan]);

  return {
    isReady,
    isPlaying,
    currentTime,
    duration,
    togglePlayPause,
    stopPlayback,
  };
}
