import { createStore } from 'zustand/vanilla';
import type { RegionStatus, TrackStatus } from '@/types/statusTypes';
import type { AudioFile } from '@/types/audioFile';

export interface RegionState {
  id: string;
  startTime: number;
  endTime: number;
  sourceStartTime: number;
  duration: number;
  status: RegionStatus[]; // types/track.ts와 통일
  audioFileUrl?: string;
}

export interface TrackState {
  id: string;
  name: string;
  volume: number;
  pan: number;
  isMuted: boolean;
  isSoloed: boolean;
  status: TrackStatus[]; // types/track.ts와 통일
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
  /* Agent State */
  isModelReady: boolean;
  modelLoadingProgress: number;
  modelLoadingText: string;

  /* Audio File State */
  audioFiles: Map<string, AudioFile>;

  // Actions (Setters)
  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setTempo: (tempo: number) => void;
  setMasterVolume: (volume: number) => void;
  setExportRange: (startTime: number | null, endTime: number | null) => void;

  addTrack: (track: TrackState) => void;
  updateTrack: (id: string, updates: Partial<TrackState>) => void;
  removeTrack: (id: string) => void;

  setAgentModelReady: (ready: boolean) => void;
  setAgentLoadingProgress: (progress: number, text: string) => void;

  addAudioFile: (url: string, file: AudioFile) => void;
  removeAudioFile: (url: string) => void;
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

    /* Agent State */
    isModelReady: false,
    modelLoadingProgress: 0,
    modelLoadingText: 'Initializing...',

    /* Audio File State */
    audioFiles: new Map(),

    /* Actions */
    setPlaying: playing => set({ isPlaying: playing }),
    setCurrentTime: time => set({ currentTime: time }),
    setTempo: tempo => set({ tempo: tempo }),
    setMasterVolume: volume => set({ masterVolume: volume }),
    setExportRange: (startTime, endTime) => set({ exportStartTime: startTime, exportEndTime: endTime }),

    /* Track Actions */
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

    /* Agent Actions */
    setAgentModelReady: ready => set({ isModelReady: ready }),
    setAgentLoadingProgress: (progress, text) => set({ modelLoadingProgress: progress, modelLoadingText: text }),

    /* Audio File Actions */
    addAudioFile: (url, file) =>
      set(state => {
        const newAudioFiles = new Map(state.audioFiles);
        newAudioFiles.set(url, file);
        return { audioFiles: newAudioFiles };
      }),
    removeAudioFile: url =>
      set(state => {
        const newAudioFiles = new Map(state.audioFiles);
        newAudioFiles.delete(url);
        return { audioFiles: newAudioFiles };
      }),
  }));
}
