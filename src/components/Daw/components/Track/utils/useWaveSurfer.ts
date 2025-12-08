import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

interface WaveSurferState {
  isReady: boolean;
  isPlaying: boolean;
  zoomLevel: number;
}

/**
 * WaveSurfer 초기화와 상태 관리를 담당하는 커스텀 훅
 */
export function useWaveSurfer(url: string) {
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [{ isReady, isPlaying, zoomLevel }, setState] = useState<WaveSurferState>({
    isReady: false,
    isPlaying: false,
    zoomLevel: 0,
  });

  useEffect(() => {
    if (!waveformRef.current) return;

    const wavesurfer = WaveSurfer.create({
      container: waveformRef.current,
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

    wavesurferRef.current = wavesurfer;

    const handleReady = () =>
      setState((prev) => ({ ...prev, isReady: true, zoomLevel: 0 }));
    const handlePlay = () => setState((prev) => ({ ...prev, isPlaying: true }));
    const handlePause = () => setState((prev) => ({ ...prev, isPlaying: false }));
    const handleFinish = () => setState((prev) => ({ ...prev, isPlaying: false }));

    wavesurfer.on('ready', handleReady);
    wavesurfer.on('play', handlePlay);
    wavesurfer.on('pause', handlePause);
    wavesurfer.on('finish', handleFinish);

    return () => {
      setState({ isReady: false, isPlaying: false, zoomLevel: 0 });
      wavesurfer.destroy();
      wavesurferRef.current = null;
    };
  }, [url]);

  const togglePlayPause = () => {
    const wavesurfer = wavesurferRef.current;
    if (!wavesurfer) return;
    wavesurfer.isPlaying() ? wavesurfer.pause() : wavesurfer.play();
  };

  const updateZoom = (value: number) => {
    setState((prev) => ({ ...prev, zoomLevel: value }));
    wavesurferRef.current?.zoom(value);
  };

  return {
    waveformRef,
    isReady,
    isPlaying,
    zoomLevel,
    togglePlayPause,
    updateZoom,
  };
}

