import { useState, useEffect, useCallback } from 'react';
import type { AudioFile } from '../FileUpload/components/types';
import * as styles from './Track.css';
import { TrackControls } from './components/TrackControls';
import { TrackHeader } from './components/TrackHeader';
import { useWaveSurfer } from './utils/useWaveSurfer';

/**
 * Track 컴포넌트의 Props 타입 정의
 * 
 * @property track - 표시할 오디오 파일 정보 (AudioFile 타입)
 * @property index - 트랙의 인덱스 (0부터 시작, 트랙 번호 표시에 사용)
 * @property onRemove - 트랙 제거 콜백 함수 (선택적, 제공 시 제거 버튼 표시)
 * @property onVolumeChange - 볼륨 변경 콜백 함수 (선택적, 제공 시 볼륨 변경 시 호출)
 */
interface TrackProps {
  track: AudioFile;
  index: number;
  onRemove?: (index: number) => void;
  onVolumeChange?: (index: number, volume: number) => void;
}

export function Track({ track, index, onRemove, onVolumeChange }: TrackProps) {
  // 로컬 볼륨 상태 (track.volume을 초기값으로 사용)
  const [volume, setVolume] = useState(track.volume ?? 1.0);

  const {
    waveformRef,
    wavesurfer,
    isReady,
    isPlaying,
    zoomLevel,
    togglePlayPause,
    updateZoom,
    setVolume: setWaveSurferVolume,
  } = useWaveSurfer({
    url: track.url,
    // @wavesurfer/react 권장 방식: 이벤트 핸들러를 props로 전달
    onReady: (ws) => {
      // 초기 볼륨 설정
      if (volume !== undefined) {
        ws.setVolume(volume);
      }
    },
  });

  // WaveSurfer에 볼륨 적용 (isReady가 true일 때)
  useEffect(() => {
    if (isReady && wavesurfer) {
      setWaveSurferVolume(volume);
    }
  }, [isReady, volume, wavesurfer, setWaveSurferVolume]);

  // track.volume이 외부에서 변경된 경우 동기화
  useEffect(() => {
    if (track.volume !== undefined && track.volume !== volume) {
      setVolume(track.volume);
    }
  }, [track.volume, volume]);

  const handleVolumeChange = useCallback(
    (newVolume: number) => {
      setVolume(newVolume);
      onVolumeChange?.(index, newVolume);
    },
    [index, onVolumeChange]
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
          isReady={isReady}
          isPlaying={isPlaying}
          zoomLevel={zoomLevel}
          volume={volume}
          onPlayToggle={togglePlayPause}
          onZoomChange={updateZoom}
          onVolumeChange={handleVolumeChange}
        />
      </div>
    </div>
  );
}

