import { useRef, useCallback } from 'react';
import { useWavesurfer } from '@wavesurfer/react';
import { WAVEFORM_CONFIG } from '../constants';

/**
 * WaveSurfer 파형 시각화 훅
 * 
 * @param audioUrl - 오디오 파일 URL
 * @param onSeek - 재생 위치 업데이트 콜백
 * @returns 파형 관련 ref 및 제어 함수
 */
export function useWaveform(
  audioUrl: string,
  onSeek?: (progress: number) => void
) {
  const waveformRef = useRef<HTMLDivElement | null>(null);

  // WaveSurfer는 파형 시각화만 사용 (재생 비활성화)
  const { wavesurfer } = useWavesurfer({
    container: waveformRef,
    url: audioUrl,
    ...WAVEFORM_CONFIG,
    interact: false, // 사용자 상호작용 비활성화 (재생 제어 안 함)
  });

  // 줌 레벨 변경
  const updateZoom = useCallback(
    (value: number) => {
      wavesurfer?.zoom(value);
    },
    [wavesurfer]
  );

  // 재생 위치 업데이트
  const updateProgress = useCallback(
    (currentTime: number, duration: number) => {
      if (wavesurfer && duration > 0) {
        wavesurfer.seekTo(currentTime / duration);
      }
      onSeek?.(currentTime / duration);
    },
    [wavesurfer, onSeek]
  );

  // 재생 위치 초기화
  const resetProgress = useCallback(() => {
    if (wavesurfer) {
      wavesurfer.seekTo(0);
    }
  }, [wavesurfer]);

  return {
    waveformRef,
    updateZoom,
    updateProgress,
    resetProgress,
  };
}
