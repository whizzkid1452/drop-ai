import { createStore } from 'zustand/vanilla';

export interface RegionState {
  id: string;
  startTime: number;
  sourceStartTime: number;
  duration: number;
  audioFileUrl?: string;
}

export interface TrackState {
  id: string;
  volume: number;
  pan: number;
  isMuted: boolean;
  isSoloed: boolean;
  regions: RegionState[];
}

export interface SessionState {
  isPlaying: boolean;
  currentTime: number;
  tempo: number;
  masterVolume: number;
  exportStartTime: number | null;
  exportEndTime: number | null;
  tracks: Map<string, TrackState>;

  // Actions (Setters)
  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setTempo: (tempo: number) => void;
  setMasterVolume: (volume: number) => void;
  setExportRange: (startTime: number | null, endTime: number | null) => void;
  addTrack: (track: TrackState) => void;
  updateTrack: (id: string, updates: Partial<TrackState>) => void;
  removeTrack: (id: string) => void;
}

export type SessionStore = ReturnType<typeof createSessionStore>;

export function createSessionStore() {
  return createStore<SessionState>(set => ({
    isPlaying: false,
    currentTime: 0,
    tempo: 120,
    masterVolume: 1.0,
    exportStartTime: null,
    exportEndTime: null,
    tracks: new Map(),

    setPlaying: playing => set({ isPlaying: playing }),

    setCurrentTime: time => set({ currentTime: time }),

    setTempo: tempo => set({ tempo: tempo }),

    setMasterVolume: volume => set({ masterVolume: volume }),

    setExportRange: (startTime, endTime) =>
      set({ exportStartTime: startTime, exportEndTime: endTime }),

    addTrack: track =>
      set(state => {
        const newTracks = new Map(state.tracks);
        newTracks.set(track.id, track);
        return { tracks: newTracks };
      }),

    updateTrack: (id, updates) =>
      set(state => {
        const track = state.tracks.get(id);
        if (!track) return state;
        const newTracks = new Map(state.tracks);
        newTracks.set(id, { ...track, ...updates });
        return { tracks: newTracks };
      }),

    removeTrack: id =>
      set(state => {
        const newTracks = new Map(state.tracks);
        newTracks.delete(id);
        return { tracks: newTracks };
      }),
  }));
}
