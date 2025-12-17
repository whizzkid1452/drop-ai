import { useRef, useCallback, useEffect, useState } from 'react';
import { loadAudioBuffer } from '../../../../../logics/audio/audioFileLoader';
import { createAudioContext } from '../../../../../logics/audio/audioContextManager';
import {
  extractWaveformData,
  renderWaveform,
} from '../utils/waveformRenderer';
import { WAVEFORM_CONFIG } from '../constants';

/**
 * Canvas 기반 파형 시각화 훅
 * 
 * @param audioUrl - 오디오 파일 URL
 * @param onSeek - 재생 위치 업데이트 콜백
 * @returns 파형 관련 ref 및 제어 함수
 */
export function useWaveform(
  audioUrl: string,
  onSeek?: (progress: number) => void
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const waveformDataRef = useRef<{ peaks: Float32Array; duration: number } | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Canvas 크기 설정 및 파형 데이터 로드
  useEffect(() => {
    let isMounted = true;

    const loadWaveform = async () => {
      if (!canvasRef.current) return;

      try {
        // Canvas 크기 설정
        const canvas = canvasRef.current;
        const container = canvas.parentElement;
        if (container) {
          const rect = container.getBoundingClientRect();
          canvas.width = rect.width * window.devicePixelRatio;
          canvas.height = WAVEFORM_CONFIG.height * window.devicePixelRatio;
          canvas.style.width = `${rect.width}px`;
          canvas.style.height = `${WAVEFORM_CONFIG.height}px`;
          
          // 고해상도 렌더링을 위한 스케일 조정
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
          }
        }

        const audioContext = createAudioContext();
        const audioBuffer = await loadAudioBuffer(audioUrl, audioContext);

        if (!isMounted) {
          audioContext.close();
          return;
        }

        // 기본 샘플 수로 파형 데이터 추출
        const baseSamples = 2000;
        const waveformData = extractWaveformData(audioBuffer, baseSamples);
        waveformDataRef.current = waveformData;

        // 초기 렌더링
        if (canvasRef.current) {
          renderWaveform(
            canvasRef.current,
            waveformData,
            WAVEFORM_CONFIG,
            0
          );
        }

        setIsReady(true);
      } catch (err) {
        console.error('파형 데이터 로드 실패:', err);
        setIsReady(false);
      }
    };

    loadWaveform();

    // 리사이즈 이벤트 핸들러
    const handleResize = () => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      const container = canvas.parentElement;
      if (container) {
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = WAVEFORM_CONFIG.height * window.devicePixelRatio;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${WAVEFORM_CONFIG.height}px`;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        }

        // 파형 재렌더링
        if (waveformDataRef.current) {
          renderWaveform(
            canvas,
            waveformDataRef.current,
            WAVEFORM_CONFIG,
            0
          );
        }
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
    };
  }, [audioUrl]);


  // 재생 위치 업데이트 (파형 진행률 표시)
  const updateProgress = useCallback(
    (currentTime: number, duration: number) => {
      if (!canvasRef.current || !waveformDataRef.current || duration <= 0) {
        return;
      }

      const progress = currentTime / duration;
      renderWaveform(
        canvasRef.current,
        waveformDataRef.current,
        WAVEFORM_CONFIG,
        progress
      );
      onSeek?.(progress);
    },
    [onSeek]
  );

  // 재생 위치 초기화
  const resetProgress = useCallback(() => {
    if (!canvasRef.current || !waveformDataRef.current) {
      return;
    }

    renderWaveform(
      canvasRef.current,
      waveformDataRef.current,
      WAVEFORM_CONFIG,
      0
    );
  }, []);

  return {
    canvasRef,
    isReady,
    updateProgress,
    resetProgress,
  };
}
