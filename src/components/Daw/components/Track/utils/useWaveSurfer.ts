import { useRef, useState, useCallback, useEffect } from 'react';
import { useWavesurfer } from '@wavesurfer/react';
import type WaveSurfer from 'wavesurfer.js';

interface UseWaveSurferOptions {
  url: string;
  onReady?: (wavesurfer: WaveSurfer) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onFinish?: () => void;
}

/**
 * WaveSurfer 초기화와 상태 관리를 담당하는 커스텀 훅
 * @wavesurfer/react의 useWavesurfer를 사용하여 최적화된 구현
 */
export function useWaveSurfer({
  url,
  onReady,
  onPlay,
  onPause,
  onFinish,
}: UseWaveSurferOptions) {
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const [zoomLevel, setZoomLevel] = useState(0);

  const { wavesurfer, isReady, isPlaying } = useWavesurfer({
    container: waveformRef,
    url,
    height: 120,
    waveColor: '#3a7bfd',
    progressColor: '#8fb2ff',
    cursorColor: '#ffcc66',
    barWidth: 2,
    barGap: 1,
    barRadius: 2,
    normalize: true,
  });

  // @wavesurfer/react의 useWavesurfer 훅은 이벤트 핸들러를 props로 받지 않으므로
  // wavesurfer 인스턴스를 통해 직접 이벤트를 구독합니다
  useEffect(() => {
    if (!wavesurfer) return;

    const handleReady = () => {
      setZoomLevel(0);
      onReady?.(wavesurfer);
    };

    // 이벤트 구독
    if (onReady) wavesurfer.on('ready', handleReady);
    if (onPlay) wavesurfer.on('play', onPlay);
    if (onPause) wavesurfer.on('pause', onPause);
    if (onFinish) wavesurfer.on('finish', onFinish);

    // Cleanup: 컴포넌트 언마운트 시 이벤트 구독 해제
    return () => {
      if (onReady) wavesurfer.un('ready', handleReady);
      if (onPlay) wavesurfer.un('play', onPlay);
      if (onPause) wavesurfer.un('pause', onPause);
      if (onFinish) wavesurfer.un('finish', onFinish);
    };
  }, [wavesurfer, onReady, onPlay, onPause, onFinish]);

  const togglePlayPause = useCallback(() => {
    wavesurfer?.playPause();
  }, [wavesurfer]);

  const updateZoom = useCallback(
    (value: number) => {
      setZoomLevel(value);
      wavesurfer?.zoom(value);
    },
    [wavesurfer]
  );

  const setVolume = useCallback(
    (value: number) => {
      // 0.0 ~ 1.0 범위로 제한
      const clampedValue = Math.max(0, Math.min(1, value));
      wavesurfer?.setVolume(clampedValue);
    },
    [wavesurfer]
  );

  return {
    waveformRef,
    wavesurfer,
    isReady: isReady ?? false,
    isPlaying: isPlaying ?? false,
    zoomLevel,
    togglePlayPause,
    updateZoom,
    setVolume,
  };
}

