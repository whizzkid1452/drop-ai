import { useState, useCallback, useEffect } from 'react';
import type { AudioFile } from '../components/FileUpload/components/types';

export function useDawTracks() {
  const [tracks, setTracks] = useState<AudioFile[]>([]);
  const [pendingFile, setPendingFile] = useState<AudioFile | null>(null);

  const disposeFile = useCallback((file?: AudioFile | null) => {
    file?.dispose?.();
  }, []);

  const addTrack = useCallback((file: AudioFile) => {
    setTracks((prev) => [...prev, file]);
  }, []);

  const removeTrack = useCallback(
    (index: number) => {
      setTracks((prev) => {
        const newTracks = [...prev];
        disposeFile(newTracks[index]);
        newTracks.splice(index, 1);
        return newTracks;
      });
    },
    [disposeFile],
  );

  const handleFileUploaded = useCallback(
    (file: AudioFile) => {
      disposeFile(pendingFile);
      setPendingFile(file);
    },
    [disposeFile, pendingFile],
  );

  const handleEdit = useCallback(() => {
    if (!pendingFile) return;
    addTrack(pendingFile);
    setPendingFile(null);
  }, [addTrack, pendingFile]);

  const updateTrackVolume = useCallback((index: number, volume: number) => {
    setTracks((prev) => {
      const newTracks = [...prev];
      if (newTracks[index]) {
        newTracks[index] = { ...newTracks[index], volume };
      }
      return newTracks;
    });
  }, []);

  // 언마운트 시 pendingFile 리소스 정리
  useEffect(() => {
    return () => disposeFile(pendingFile);
  }, [disposeFile, pendingFile]);

  return {
    tracks,
    pendingFile,
    addTrack,
    removeTrack,
    handleFileUploaded,
    handleEdit,
    updateTrackVolume,
  };
}
