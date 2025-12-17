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
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  
  const waveformRef = useRef<HTMLDivElement | null>(null);
  
  // Web Audio API 관련 refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const pannerNodeRef = useRef<StereoPannerNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  // WaveSurfer는 파형 시각화만 사용 (재생 비활성화)
  const { wavesurfer } = useWavesurfer({
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
    interact: false, // 사용자 상호작용 비활성화 (재생 제어 안 함)
  });

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
        const response = await fetch(track.url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        if (!isMounted) return;
        
        audioBufferRef.current = audioBuffer;

        // GainNode 생성 (볼륨 제어)
        const gainNode = audioContext.createGain();
        gainNode.gain.value = volume;
        gainNodeRef.current = gainNode;

        // StereoPannerNode 생성 (패닝 제어)
        const panner = audioContext.createStereoPanner();
        panner.pan.value = pan;
        pannerNodeRef.current = panner;

        // 오디오 그래프 연결: source -> gain -> panner -> destination
        // (실제 재생 시 sourceNode를 연결)

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
  }, [track.url, stopPlayback]);

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

  // 재생 시간 업데이트 함수
  const updateCurrentTime = useCallback(() => {
    if (!isPlaying || !audioContextRef.current || !audioBufferRef.current) {
      return;
    }

    const elapsed = audioContextRef.current.currentTime - startTimeRef.current + pausedTimeRef.current;
    const duration = audioBufferRef.current.duration;
    
    if (elapsed >= duration) {
      // 재생 완료
      stopPlayback();
      setCurrentTime(0);
      pausedTimeRef.current = 0;
    } else {
      setCurrentTime(elapsed);
      // WaveSurfer 재생 위치 업데이트
      if (wavesurfer) {
        wavesurfer.seekTo(elapsed / duration);
      }
      animationFrameRef.current = requestAnimationFrame(updateCurrentTime);
    }
  }, [isPlaying, wavesurfer, stopPlayback]);

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
        if (wavesurfer) {
          wavesurfer.seekTo(0);
        }
      };

      setIsPlaying(true);
      updateCurrentTime();
    }
  }, [isReady, isPlaying, currentTime, wavesurfer, stopPlayback, updateCurrentTime]);

  // 줌 레벨 변경
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

