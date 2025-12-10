import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { AudioFile } from '@/components/DropZone/components/FileUpload/components/types';

interface TrackContextValue {
  tracks: AudioFile[];
  addTrack: (file: AudioFile) => void;
  removeTrack: (index: number) => void;
  clearTracks: () => void;
}

const TrackContext = createContext<TrackContextValue | undefined>(undefined);

export function TrackProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracks] = useState<AudioFile[]>([]);

  const addTrack = useCallback((file: AudioFile) => {
    setTracks((prev) => [...prev, file]);
  }, []);

  const removeTrack = useCallback((index: number) => {
    setTracks((prev) => {
      const newTracks = [...prev];
      // 추상화된 cleanup 메서드를 통해 리소스 정리
      newTracks[index]?.dispose?.();
      newTracks.splice(index, 1);
      return newTracks;
    });
  }, []);

  const clearTracks = useCallback(() => {
    setTracks((prev) => {
      // 추상화된 cleanup 메서드를 통해 리소스 정리
      prev.forEach((track) => {
        track.dispose?.();
      });
      return [];
    });
  }, []);

  return (
    <TrackContext.Provider value={{ tracks, addTrack, removeTrack, clearTracks }}>
      {children}
    </TrackContext.Provider>
  );
}

export function useTracks() {
  const context = useContext(TrackContext);
  if (context === undefined) {
    throw new Error('useTracks must be used within a TrackProvider');
  }
  return context;
}

