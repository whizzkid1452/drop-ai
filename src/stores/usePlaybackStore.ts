import { create } from 'zustand';

interface PlaybackStore {
  isPlaying: boolean;
  currentTime: number;
  tempo: number;
  pixelsPerSecond: number;

  setIsPlaying: (isPlaying: boolean) => void;
  setCurrentTime: (time: number) => void;
  setTempo: (tempo: number) => void;
  setPixelsPerSecond: (pixelsPerSecond: number) => void;
}

export const usePlaybackStore = create<PlaybackStore>(set => ({
  isPlaying: false,
  currentTime: 0,
  tempo: 120, // Default BPM
  pixelsPerSecond: 20,

  setIsPlaying: isPlaying => set({ isPlaying }),
  setCurrentTime: currentTime => set({ currentTime }),
  setTempo: tempo => set({ tempo }),
  setPixelsPerSecond: pixelsPerSecond => set({ pixelsPerSecond }),
}));
