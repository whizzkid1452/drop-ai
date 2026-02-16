import { createStore } from 'zustand/vanilla';

export interface RegionState {
  id: string;
  trackId: string;
  src: string; // Blob URL
  startTime: number; // Timeline position (seconds)
  duration: number; // Region length (seconds)
  offset: number; // Start point within buffer (seconds)
}

export interface TrackState {
  id: string;
  name: string;
  volume: number;
  isMuted: boolean;
  isSoloed: boolean;
  regions: RegionState[];
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
  addRegion: (trackId: string, region: RegionState) => void;
  removeRegion: (trackId: string, regionId: string) => void;
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

    addRegion: (trackId, region) =>
      set(state => {
        const track = state.tracks.get(trackId);
        if (!track) return state;

        const newRegions = [...track.regions, region];
        const newTrack = { ...track, regions: newRegions };
        const newTracks = new Map(state.tracks);
        newTracks.set(trackId, newTrack);
        return { tracks: newTracks };
      }),

    removeRegion: (trackId, regionId) =>
      set(state => {
        const track = state.tracks.get(trackId);
        if (!track) return state;

        const newRegions = track.regions.filter(r => r.id !== regionId);
        const newTrack = { ...track, regions: newRegions };
        const newTracks = new Map(state.tracks);
        newTracks.set(trackId, newTrack);
        return { tracks: newTracks };
      }),
  }));
}
