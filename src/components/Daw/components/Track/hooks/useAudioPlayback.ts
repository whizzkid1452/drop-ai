import { useEffect, useRef } from 'react';
import { usePlaybackState } from './usePlaybackState';
import { usePlaybackControl } from './usePlaybackControl';
import { createAudioContext, createAudioNodes, updateVolume, updatePan } from '../../../../../logics/audio/audioContextManager';
import { loadAudioBuffer } from '../../../../../logics/audio/audioFileLoader';
import type { AudioNodes } from '../../../../../logics/audio/audioContextManager';

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
  // Web Audio API 관련 refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const nodesRef = useRef<AudioNodes | null>(null);

  // 재생 상태 관리
  const playbackState = usePlaybackState();

  // 재생 제어
  const { togglePlayPause, stopPlayback } = usePlaybackControl(
    audioContextRef,
    audioBufferRef,
    nodesRef,
    playbackState,
    onTimeUpdate,
    onPlaybackEnd
  );

  // Web Audio API 초기화 및 오디오 로드
  useEffect(() => {
    let isMounted = true;

    const initAudio = async () => {
      try {
        // AudioContext 생성
        const audioContext = createAudioContext();
        audioContextRef.current = audioContext;

        // 오디오 파일 로드 및 디코딩
        const audioBuffer = await loadAudioBuffer(audioUrl, audioContext);

        if (!isMounted) return;

        audioBufferRef.current = audioBuffer;
        playbackState.setAudioDuration(audioBuffer.duration);

        // 오디오 노드 생성
        const nodes = createAudioNodes(audioContext, volume, pan);
        nodesRef.current = nodes;

        playbackState.setReady(true);
      } catch (err) {
        console.error('오디오 초기화 실패:', err);
        playbackState.setReady(false);
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
      nodesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  // 볼륨 및 패닝 변경 시 노드 재생성 (volume, pan 변경 시)
  useEffect(() => {
    if (!audioContextRef.current || !audioBufferRef.current) return;

    // 노드가 이미 생성되어 있고 재생 중이 아닐 때만 업데이트
    if (nodesRef.current) {
      updateVolume(nodesRef.current.gainNode, volume, audioContextRef.current);
      updatePan(nodesRef.current.pannerNode, pan, audioContextRef.current);
    } else {
      // 노드가 없으면 생성
      const nodes = createAudioNodes(audioContextRef.current, volume, pan);
      nodesRef.current = nodes;
    }
  }, [volume, pan]);

  return {
    isReady: playbackState.isReady,
    isPlaying: playbackState.isPlaying,
    currentTime: playbackState.currentTime,
    duration: playbackState.duration,
    togglePlayPause,
    stopPlayback,
  };
}
