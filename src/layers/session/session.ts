import { createStore } from 'zustand/vanilla';

export interface TrackState {
  id: string;
  volume: number;
  isMuted: boolean;
  isSoloed: boolean;
  src: string | null;
}

// State (Data)
export interface SessionData {
  isPlaying: boolean;
  masterVolume: number;
  tracks: Map<string, TrackState>;
}

// Actions (Setters)
export interface SessionActions {
  setPlaying: (playing: boolean) => void;
  setMasterVolume: (volume: number) => void;
  addTrack: (track: TrackState) => void;
  updateTrack: (id: string, updates: Partial<TrackState>) => void;
  removeTrack: (id: string) => void;
}

export interface SessionState extends SessionData, SessionActions {}

export type SessionStore = ReturnType<typeof createSessionStore>;

export function createSessionStore() {
  return createStore<SessionState>(set => ({
    isPlaying: false,
    masterVolume: 1.0,
    tracks: new Map(),

    setPlaying: playing => set({ isPlaying: playing }),

    setMasterVolume: volume => set({ masterVolume: volume }),

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
