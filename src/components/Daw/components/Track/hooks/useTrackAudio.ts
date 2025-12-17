import { useState, useEffect, useCallback } from 'react';
import type { AudioFile } from '@/components/Daw/components/FileUpload/components/types';

/**
 * 트랙의 볼륨 및 패닝 상태 관리 훅
 * 
 * @param track - 오디오 파일 정보
 * @param index - 트랙 인덱스
 * @param onVolumeChange - 볼륨 변경 콜백
 * @param onPanChange - 패닝 변경 콜백
 * @returns 볼륨/패닝 상태 및 핸들러
 */
export function useTrackAudio(
  track: AudioFile,
  index: number,
  onVolumeChange?: (index: number, volume: number) => void,
  onPanChange?: (index: number, pan: number) => void
) {
  // 로컬 볼륨 상태 (track.volume을 초기값으로 사용)
  const [volume, setVolume] = useState(track.volume ?? 1.0);
  // 로컬 패닝 상태 (track.pan을 초기값으로 사용)
  const [pan, setPan] = useState(track.pan ?? 0.0);

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

  return {
    volume,
    pan,
    handleVolumeChange,
    handlePanChange,
  };
}
