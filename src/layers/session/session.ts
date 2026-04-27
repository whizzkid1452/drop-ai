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
  pan: number;
  regions: RegionState[];
}

// State (Data)
export interface SessionData {
  isPlaying: boolean;
  masterVolume: number;
  bpm: number;
  isLooping: boolean;
  loopStart: number;
  loopEnd: number;
  tracks: Map<string, TrackState>;
}

// Actions (Setters)
export interface SessionActions {
  setPlaying: (playing: boolean) => void;
  setMasterVolume: (volume: number) => void;
  setBpm: (bpm: number) => void;
  setLoop: (isLooping: boolean) => void;
  setLoopPoints: (start: number, end: number) => void;
  addTrack: (track: TrackState) => void;
  updateTrack: (id: string, updates: Partial<TrackState>) => void;
  removeTrack: (id: string) => void;
  addRegion: (trackId: string, region: RegionState) => void;
  updateRegion: (
    trackId: string,
    regionId: string,
    updates: Partial<RegionState>
  ) => void;
  removeRegion: (trackId: string, regionId: string) => void;
}

export interface SessionState extends SessionData, SessionActions {}

export type SessionStore = ReturnType<typeof createSessionStore>;

export function createSessionStore() {
  return createStore<SessionState>(set => ({
    isPlaying: false,
    masterVolume: 1.0,
    bpm: 120,
    isLooping: false,
    loopStart: 0,
    loopEnd: 4,
    tracks: new Map(), //트랙 추가/삭제/조회가 많고 키 기반 접근이 많다. id 식별자 기반으로 자주 조회, 수정, 삭제..

    setPlaying: playing => set({ isPlaying: playing }),

    setMasterVolume: volume => set({ masterVolume: volume }),

    setBpm: bpm => set({ bpm }),

    setLoop: isLooping => set({ isLooping }),

    setLoopPoints: (start, end) => set({ loopStart: start, loopEnd: end }),

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

    updateRegion: (trackId, regionId, updates) =>
      set(state => {
        const track = state.tracks.get(trackId);
        if (!track) return state;

        const newRegions = track.regions.map(r =>
          r.id === regionId ? { ...r, ...updates } : r
        );
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
