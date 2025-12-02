import { useCallback } from 'react';
import { Session, Track } from '../core/audio';
import type { UploadedFile } from '../types/daw';

/**
 * 트랙 관리 훅
 * 트랙 볼륨, Mute, Solo, Pan, 삭제 관리를 담당
 */
export function useTrackManagement(
  session: Session,
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>
) {
  const engine = session.getAudioEngine();

  const handleTrackVolumeChange = useCallback(
    (track: Track, volume: number) => {
      track.setVolume(volume);
    },
    []
  );

  const handleTrackMute = useCallback(
    (track: Track, muted: boolean) => {
      track.setMuted(muted);
      engine.recomputeSoloMute();
    },
    [engine]
  );

  const handleTrackSolo = useCallback(
    (track: Track, solo: boolean) => {
      track.setSolo(solo);
      engine.recomputeSoloMute();
    },
    [engine]
  );

  const handleTrackPanChange = useCallback((track: Track, pan: number) => {
    track.setPan(pan);
  }, []);

  const handleTrackDelete = useCallback(
    (track: Track) => {
      if (confirm(`트랙 "${track.getName()}"을(를) 삭제하시겠습니까?`)) {
        // Session을 통해 트랙 제거 (Undo 가능)
        session.removeTrack(track);
        setUploadedFiles(prev => prev.filter(u => u.track !== track));
        track.dispose();
      }
    },
    [session, setUploadedFiles]
  );

  return {
    handleTrackVolumeChange,
    handleTrackMute,
    handleTrackSolo,
    handleTrackPanChange,
    handleTrackDelete,
  };
}

