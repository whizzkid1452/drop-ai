import { createStore } from 'zustand/vanilla';
import type { RegionStatus, TrackStatus } from '@/types/statusTypes';
import type { AgentRunStatus, AgentStatus, Message } from '@/types/agent';
import type { ProjectMetadata } from '../shared/types/project-document.schema';

interface RegionCommonState {
  id: string;
  startTime: number;
  endTime: number;
  sourceStartTime: number;
  duration: number;
  status: RegionStatus[];
}

type RegionSource = {
  sourceId: string;
  audioFileUrl?: never;
};

export type RegionState = RegionCommonState & RegionSource;

export interface TrackState {
  id: string;
  name: string;
  volume: number;
  pan: number;
  isMuted: boolean;
  isSoloed: boolean;
  status: TrackStatus[];
  regions: RegionState[];
}

export interface SessionState {
  project: ProjectMetadata;
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
  agentMessages: Message[];
  agentStatus: AgentStatus;
  agentRunStatus: AgentRunStatus;
  hasSuccessfulAgentResult: boolean;

  // Actions (Setters)
  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  stopPlayback: () => void;
  setTempo: (tempo: number) => void;
  setMasterVolume: (volume: number) => void;
  setExportRange: (startTime: number | null, endTime: number | null) => void;
  replaceProjectMetadata: (project: ProjectMetadata) => void;

  addTrack: (track: TrackState) => void;
  updateTrack: (id: string, updates: Partial<TrackState>) => void;
  removeTrack: (id: string) => void;

  setAgentModelReady: (ready: boolean) => void;
  setAgentLoadingProgress: (progress: number, text: string) => void;
  addAgentMessage: (message: Message) => void;
  updateAgentMessage: (id: string, content: string) => void;
  setAgentStatus: (status: AgentStatus) => void;
  setAgentRunStatus: (status: AgentRunStatus) => void;
  markAgentResultSuccessful: () => void;
  resetAgentWorkflow: () => void;
}

export type SessionStore = ReturnType<typeof createSessionStore>;

export interface CreateSessionStoreOptions {
  readonly initialProjectMetadata: ProjectMetadata;
}

export function createSessionStore({ initialProjectMetadata }: CreateSessionStoreOptions) {
  return createStore<SessionState>(set => ({
    project: { ...initialProjectMetadata },
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
    agentMessages: [],
    agentStatus: 'idle',
    agentRunStatus: 'idle',
    hasSuccessfulAgentResult: false,

    /* Actions */
    setPlaying: playing => set({ isPlaying: playing }),
    setCurrentTime: time => set({ currentTime: time }),
    stopPlayback: () => set({ isPlaying: false, currentTime: 0 }),
    setTempo: tempo => set({ tempo: tempo }),
    setMasterVolume: volume => set({ masterVolume: volume }),
    setExportRange: (startTime, endTime) => set({ exportStartTime: startTime, exportEndTime: endTime }),
    replaceProjectMetadata: project => set({ project: { ...project } }),

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
    addAgentMessage: message => set(state => ({ agentMessages: [...state.agentMessages, message] })),
    updateAgentMessage: (id, content) =>
      set(state => ({
        agentMessages: state.agentMessages.map(message => (message.id === id ? { ...message, content } : message)),
      })),
    setAgentStatus: agentStatus => set({ agentStatus }),
    setAgentRunStatus: agentRunStatus => set({ agentRunStatus }),
    // 최근 실행 상태와 분리해, 후속 요청이 실패해도 이미 열린 편집 화면을 유지한다.
    markAgentResultSuccessful: () => set({ hasSuccessfulAgentResult: true }),
    resetAgentWorkflow: () =>
      set({
        agentMessages: [],
        agentStatus: 'idle',
        agentRunStatus: 'idle',
        hasSuccessfulAgentResult: false,
      }),
  }));
}
