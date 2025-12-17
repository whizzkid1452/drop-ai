import { useCallback } from 'react';
import type { AudioFile } from '../FileUpload/components/types';
import * as styles from './Track.css';
import { TrackControls } from './components/TrackControls';
import { TrackHeader } from './components/TrackHeader';
import { useAudioPlayback } from './hooks/useAudioPlayback';
import { useTrackAudio } from './hooks/useTrackAudio';
import { useWaveform } from './hooks/useWaveform';

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
  // 볼륨 및 패닝 상태 관리
  const { volume, pan, handleVolumeChange, handlePanChange } = useTrackAudio(
    track,
    index,
    onVolumeChange,
    onPanChange
  );

  // Canvas 파형 시각화
  const { canvasRef, updateProgress, resetProgress } = useWaveform(
    track.url,
    undefined // onSeek는 필요시 추가 가능
  );

  // 재생 시간 업데이트 시 Canvas 위치 동기화
  const handleTimeUpdate = useCallback(
    (currentTime: number, duration: number) => {
      updateProgress(currentTime, duration);
    },
    [updateProgress]
  );

  // 재생 완료 시 Canvas 위치 초기화
  const handlePlaybackEnd = useCallback(() => {
    resetProgress();
  }, [resetProgress]);

  // Web Audio API 재생 관리
  const { isReady, isPlaying, togglePlayPause } = useAudioPlayback(
    track.url,
    volume,
    pan,
    handleTimeUpdate,
    handlePlaybackEnd
  );

  return (
    <div className={styles.track}>
      <TrackHeader track={track} index={index} onRemove={onRemove} />

      {/* 트랙 콘텐츠 영역: 파형 및 에디팅 컨트롤 */}
      <div className={styles.trackContent}>
        <div className={styles.waveformContainer}>
          <canvas
            ref={canvasRef}
            className={styles.waveformCanvas}
            aria-label="파형 뷰"
          />
        </div>

        <TrackControls
          index={index}
          isReady={isReady}
          isPlaying={isPlaying}
          volume={volume}
          pan={pan}
          onPlayToggle={togglePlayPause}
          onVolumeChange={handleVolumeChange}
          onPanChange={handlePanChange}
        />
      </div>
    </div>
  );
}

