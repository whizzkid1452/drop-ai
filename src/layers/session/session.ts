import { createStore } from 'zustand/vanilla';
import type { RegionStatus, TrackStatus } from '@/types/statusTypes';
import type { AgentRunStatus, AgentStatus, Message } from '@/types/agent';
import type { ProjectMetadata } from '../shared/types/project-document.schema';
import type {
  PluginCatalogEntry,
  PluginInstanceState,
  PluginLogEntry,
  PluginParameterState,
  PluginValidationResult,
} from '../shared/types/plugin-state';

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
  pluginInstances: PluginInstanceState[];
  regions: RegionState[];
}

export interface ProjectSessionState {
  readonly project: ProjectMetadata;
  readonly tempo: number;
  readonly masterVolume: number;
  readonly exportStartTime: number | null;
  readonly exportEndTime: number | null;
  readonly tracks: ReadonlyMap<string, TrackState>;
}

interface PluginCatalogStateInput {
  readonly manifests: readonly PluginCatalogEntry[];
  readonly validationResults: readonly PluginValidationResult[];
}

interface AddPluginInstanceRequest {
  readonly trackId: string;
  readonly instance: PluginInstanceState;
}

interface RemovePluginInstanceRequest {
  readonly trackId: string;
  readonly instanceId: string;
}

interface SetPluginParameterValueRequest {
  readonly trackId: string;
  readonly instanceId: string;
  readonly parameterId: string;
  readonly value: PluginParameterState['value'];
}

interface UpdateTrackPluginInstancesRequest {
  readonly state: SessionState;
  readonly trackId: string;
  readonly updatePluginInstances: (instances: readonly PluginInstanceState[]) => PluginInstanceState[];
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
  pluginCatalog: Map<string, PluginCatalogEntry>;
  pluginValidationResults: Map<string, PluginValidationResult>;
  pluginLogs: PluginLogEntry[];

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
  replaceProjectState: (projectState: ProjectSessionState) => void;

  addTrack: (track: TrackState) => void;
  updateTrack: (id: string, updates: Partial<TrackState>) => void;
  removeTrack: (id: string) => void;

  replacePluginCatalogState: (pluginCatalogState: PluginCatalogStateInput) => void;
  addPluginLog: (entry: PluginLogEntry) => void;
  addPluginInstance: (request: AddPluginInstanceRequest) => void;
  removePluginInstance: (request: RemovePluginInstanceRequest) => void;
  setPluginParameterValue: (request: SetPluginParameterValueRequest) => void;

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
    pluginCatalog: new Map(),
    pluginValidationResults: new Map(),
    pluginLogs: [],

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
    replaceProjectState: projectState =>
      set({
        project: { ...projectState.project },
        tempo: projectState.tempo,
        masterVolume: projectState.masterVolume,
        exportStartTime: projectState.exportStartTime,
        exportEndTime: projectState.exportEndTime,
        tracks: cloneProjectTracks(projectState.tracks),
        isPlaying: false,
        currentTime: 0,
      }),

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

    replacePluginCatalogState: ({ manifests, validationResults }) => {
      const pluginCatalog = createPluginCatalog(manifests);
      const pluginValidationResults = createPluginValidationResults(validationResults);
      set({ pluginCatalog, pluginValidationResults });
    },
    addPluginLog: entry => set(state => ({ pluginLogs: [...state.pluginLogs, { ...entry }] })),
    addPluginInstance: ({ trackId, instance }) =>
      set(state =>
        updateTrackPluginInstances({
          state,
          trackId,
          updatePluginInstances: pluginInstances => [...pluginInstances, clonePluginInstance(instance)],
        })
      ),
    removePluginInstance: ({ trackId, instanceId }) =>
      set(state =>
        updateTrackPluginInstances({
          state,
          trackId,
          updatePluginInstances: pluginInstances => pluginInstances.filter(instance => instance.id !== instanceId),
        })
      ),
    setPluginParameterValue: ({ trackId, instanceId, parameterId, value }) =>
      set(state =>
        updateTrackPluginInstances({
          state,
          trackId,
          updatePluginInstances: pluginInstances =>
            pluginInstances.map(instance => {
              if (instance.id !== instanceId) {
                return instance;
              }
              return {
                ...instance,
                parameters: instance.parameters.map(parameter =>
                  parameter.id === parameterId ? { ...parameter, value } : parameter
                ),
              };
            }),
        })
      ),

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

function cloneProjectTracks(tracks: ReadonlyMap<string, TrackState>): Map<string, TrackState> {
  return new Map(
    [...tracks.entries()].map(([trackId, track]) => [
      trackId,
      {
        ...track,
        status: [...track.status],
        pluginInstances: track.pluginInstances.map(clonePluginInstance),
        regions: track.regions.map(region => ({ ...region, status: [...region.status] })),
      },
    ])
  );
}

function clonePluginInstance(instance: PluginInstanceState): PluginInstanceState {
  return {
    ...instance,
    manifestSummary: { ...instance.manifestSummary },
    parameters: instance.parameters.map(parameter => ({ ...parameter })),
  };
}

function updateTrackPluginInstances({
  state,
  trackId,
  updatePluginInstances,
}: UpdateTrackPluginInstancesRequest): SessionState | Pick<SessionState, 'tracks'> {
  const track = state.tracks.get(trackId);
  if (!track) {
    return state;
  }

  const tracks = new Map(state.tracks);
  tracks.set(trackId, { ...track, pluginInstances: updatePluginInstances(track.pluginInstances) });
  return { tracks };
}

function createPluginCatalog(manifests: readonly PluginCatalogEntry[]): Map<string, PluginCatalogEntry> {
  return new Map(
    manifests.map(manifest => [
      manifest.id,
      {
        ...manifest,
        parameters: manifest.parameters.map(parameter =>
          parameter.type === 'enum'
            ? { ...parameter, options: parameter.options.map(option => ({ ...option })) }
            : { ...parameter }
        ),
      },
    ])
  );
}

function createPluginValidationResults(
  results: readonly PluginValidationResult[]
): Map<string, PluginValidationResult> {
  return new Map(
    results.map(result => [
      result.manifestId,
      {
        ...result,
        issues: result.issues.map(issue => ({ ...issue, path: [...issue.path] })),
      },
    ])
  );
}
