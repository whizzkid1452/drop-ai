import { useState, useEffect, useCallback, useRef } from 'react';
import { useWavesurfer } from '@wavesurfer/react';
import type { AudioFile } from '../FileUpload/components/types';
import * as styles from './Track.css';
import { TrackControls } from './components/TrackControls';
import { TrackHeader } from './components/TrackHeader';

/**
 * Track 컴포넌트의 Props 타입 정의
 * 
 * @property track - 표시할 오디오 파일 정보 (AudioFile 타입)
 * @property index - 트랙의 인덱스 (0부터 시작, 트랙 번호 표시에 사용)
 * @property onRemove - 트랙 제거 콜백 함수 (선택적, 제공 시 제거 버튼 표시)
 * @property onVolumeChange - 볼륨 변경 콜백 함수 (선택적, 제공 시 볼륨 변경 시 호출)
 * @property onPanChange - 패닝 변경 콜백 함수 (선택적, 제공 시 패닝 변경 시 호출)
 */
interface TrackProps {
  track: AudioFile;
  index: number;
  onRemove?: (index: number) => void;
  onVolumeChange?: (index: number, volume: number) => void;
  onPanChange?: (index: number, pan: number) => void;
}

export function Track({ track, index, onRemove, onVolumeChange, onPanChange }: TrackProps) {
  // 로컬 볼륨 상태 (track.volume을 초기값으로 사용)
  const [volume, setVolume] = useState(track.volume ?? 1.0);
  // 로컬 패닝 상태 (track.pan을 초기값으로 사용)
  const [pan, setPan] = useState(track.pan ?? 0.0);
  const [zoomLevel, setZoomLevel] = useState(0);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const pannerNodeRef = useRef<StereoPannerNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // @wavesurfer/react의 useWavesurfer 훅 직접 사용
  const { wavesurfer, isReady, isPlaying } = useWavesurfer({
    container: waveformRef,
    url: track.url,
    height: 120,
    waveColor: '#3a7bfd',
    progressColor: '#8fb2ff',
    cursorColor: '#ffcc66',
    barWidth: 2,
    barGap: 1,
    barRadius: 2,
    normalize: true,
  });

  // 초기 볼륨 및 패닝 설정, Web Audio API 설정
  useEffect(() => {
    if (!wavesurfer) return;

    const handleReady = () => {
      setZoomLevel(0);
      // 초기 볼륨 설정
      if (volume !== undefined) {
        wavesurfer.setVolume(volume);
      }

      // Web Audio API를 사용한 패닝 설정
      try {
        const backend = (wavesurfer as any).backend;
        if (backend && backend.ac) {
          const audioContext = backend.ac;
          audioContextRef.current = audioContext;

          // StereoPannerNode 생성
          const panner = audioContext.createStereoPanner();
          pannerNodeRef.current = panner;

          // WaveSurfer의 필터 체인에 패너 추가
          backend.setFilter(panner);

          // 초기 패닝 값 설정
          if (pan !== undefined) {
            const clampedPan = Math.max(-1, Math.min(1, pan));
            panner.pan.setValueAtTime(clampedPan, audioContext.currentTime);
          }
        }
      } catch (err) {
        console.warn('패닝 설정 실패:', err);
      }
    };

    wavesurfer.on('ready', handleReady);

    return () => {
      wavesurfer.un('ready', handleReady);
      // 필터 제거
      if (pannerNodeRef.current) {
        try {
          const backend = (wavesurfer as any).backend;
          if (backend) {
            backend.setFilter(null);
          }
        } catch (err) {
          console.warn('패너 제거 실패:', err);
        }
      }
      pannerNodeRef.current = null;
      audioContextRef.current = null;
    };
  }, [wavesurfer, volume, pan]);

  // WaveSurfer에 볼륨 적용 (볼륨 변경 시)
  useEffect(() => {
    if (isReady && wavesurfer) {
      const clampedValue = Math.max(0, Math.min(1, volume));
      wavesurfer.setVolume(clampedValue);
    }
  }, [isReady, volume, wavesurfer]);

  // track.volume이 외부에서 변경된 경우 동기화
  useEffect(() => {
    if (track.volume !== undefined && track.volume !== volume) {
      setVolume(track.volume);
    }
  }, [track.volume, volume]);

  // track.pan이 외부에서 변경된 경우 동기화
  useEffect(() => {
    if (track.pan !== undefined && track.pan !== pan) {
      setPan(track.pan);
    }
  }, [track.pan, pan]);

  // 패닝 변경 시 Web Audio API에 적용
  useEffect(() => {
    if (pannerNodeRef.current && audioContextRef.current) {
      const clampedValue = Math.max(-1, Math.min(1, pan));
      pannerNodeRef.current.pan.setValueAtTime(
        clampedValue,
        audioContextRef.current.currentTime
      );
    }
  }, [pan]);

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

  const handleVolumeChange = useCallback(
    (newVolume: number) => {
      setVolume(newVolume);
      onVolumeChange?.(index, newVolume);
    },
    [index, onVolumeChange]
  );

  const handlePanChange = useCallback(
    (newPan: number) => {
      setPan(newPan);
      onPanChange?.(index, newPan);
    },
    [index, onPanChange]
  );

  return (
    <div className={styles.track}>
      <TrackHeader track={track} index={index} onRemove={onRemove} />

      {/* 트랙 콘텐츠 영역: 파형 및 에디팅 컨트롤 */}
      <div className={styles.trackContent}>
        <div
          ref={waveformRef}
          className={styles.waveformContainer}
          aria-label="파형 뷰"
        />

        <TrackControls
          index={index}
          isReady={isReady ?? false}
          isPlaying={isPlaying ?? false}
          zoomLevel={zoomLevel}
          volume={volume}
          pan={pan}
          onPlayToggle={togglePlayPause}
          onZoomChange={updateZoom}
          onVolumeChange={handleVolumeChange}
          onPanChange={handlePanChange}
        />
      </div>
    </div>
  );
}

