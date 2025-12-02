import { useState, useCallback } from 'react';
import { Session, /* Track, */ Clip, AudioRegion } from '../core/audio';
import type { UploadedFile } from '../types/daw';
// import type { AudioEngine } from '../core/audio';

/**
 * 파일 관리 훅
 * 파일 업로드, 삭제, 트랙 생성 관리를 담당
 */
export function useFileManagement(session: Session, isPlaying: boolean) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const engine = session.getAudioEngine();

  const handleFileAdd = useCallback(
    (file: File, buffer: AudioBuffer) => {
      const fileId = `${file.name}-${Date.now()}`;
      const sourceId = `source_${fileId}`;

      // Session을 통해 새 트랙 생성 (Undo 가능)
      const trackNumber = session.getTrackCount() + 1;
      const newTrack = session.addTrack(`Track ${trackNumber}`);

      // AudioRegion 생성
      const region = new AudioRegion(buffer, sourceId, {
        name: file.name,
        start: 0,
        length: buffer.duration,
        muted: false,
        locked: false,
      });

      // Region을 Playlist에 추가 (타임라인 위치 0에서 시작)
      newTrack.addRegion(region, 0);

      // 호환성을 위한 Clip 생성 (UI에서 사용하지 않지만 타입 호환성을 위해 유지)
      const clip = new Clip(engine.getAudioContext(), buffer, 0);

      // 상태 업데이트
      const uploadedFile: UploadedFile = {
        id: fileId,
        file,
        buffer,
        track: newTrack,
        clip, // 호환성을 위해 유지 (실제로는 사용하지 않음)
      };

      setUploadedFiles(prev => [...prev, uploadedFile]);

      // 재생 중이면 즉시 재생
      if (engine.getTransport().isPlayingState()) {
        const currentTime = engine.getAudioContext().currentTime;
        newTrack.play(
          engine.getAudioContext(),
          currentTime,
          engine.getTransport().getPosition()
        );
      }
    },
    [session, engine]
  );

  const handleFileDelete = useCallback(
    (fileId: string) => {
      const file = uploadedFiles.find(f => f.id === fileId);
      if (!file) return;

      if (confirm(`파일 "${file.file.name}"을(를) 삭제하시겠습니까?`)) {
        // 트랙도 함께 삭제 (Session을 통해 - Undo 가능)
        if (file.track) {
          // 재생 중이면 먼저 정지
          if (isPlaying) {
            file.track.stop();
          }

          // Session을 통해 트랙 제거
          session.removeTrack(file.track);

          // 트랙 리소스 정리
          file.track.dispose();
        }

        setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
      }
    },
    [session, uploadedFiles, isPlaying]
  );

  return {
    uploadedFiles,
    setUploadedFiles,
    handleFileAdd,
    handleFileDelete,
  };
}

