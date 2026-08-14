import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import { AudioEngine } from '../audio-engine/audio-engine';
import { DawEngineAdapter } from '../audio-engine/daw-engine-adapter';
import { AudioWorkletPcmCapture } from '../audio-engine/live-input/audio-worklet-pcm-capture';
import { BrowserLiveAudioInput } from '../audio-engine/live-input/browser-live-audio-input';
import { QuantizedLoopRuntime } from '../audio-engine/loop-runtime/quantized-loop-runtime';
import { ToneLoopPlaybackAdapter } from '../audio-engine/loop-runtime/tone-loop-playback-adapter';
import { readAudioRuntimeEnvironment } from '../audio-engine/audio-runtime-environment';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
import { ToneGainPluginRuntimeFactory } from '../audio-engine/plugins/tone-gain-plugin-runtime';
import { ToneSaturationPluginRuntimeFactory } from '../audio-engine/plugins/tone-saturation-plugin-runtime';
import { AudioSourceRegistry } from '../audio-source-registry/audio-source-registry';
import { BrowserObjectUrlAdapter } from '../audio-source-registry/browser-object-url-adapter';
import type {
  IAudioSourceRegistry,
  IAudioSourceResolver,
  IAudioSourceStager,
} from '../audio-source-registry/i-audio-source-registry';
import type { IAudioSourceRepository } from '../audio-source-repository/i-audio-source-repository';
import { OpfsAudioSourceRepository } from '../audio-source-repository/opfs-audio-source-repository';
import { createSessionStore, type SessionStore } from '../session/session';
import { createSessionQuery, type ISessionQuery } from '../session/session-query';
import { AppController } from '../controllers/app-controller';
import { CommandExecutor } from '../commands/command-executor';
import { CommandHistory, type ICommandHistoryQuery } from '../commands/command-history';
import {
  AgentRuntimeCommandExecutor,
  type IAgentRuntimeCommandExecutor,
} from '../commands/agent-runtime-command-executor';
import { BrowserUndoJournal } from '../commands/undo-journal';
import { BrowserSessionRecoveryStore, type ISessionRecoveryQuery } from '../queries/session-recovery-query';
import { PlaybackClockQuery, type IPlaybackClockQuery } from '../queries/playback-clock-query';
import { MeterQuery, type IMeterQuery } from '../queries/meter-query';
import { LiveInputQuery, type ILiveInputQuery } from '../queries/live-input-query';
import { RecordingQuery, type IRecordingQuery } from '../queries/recording-query';
import { MidiRecordingQuery, type IMidiRecordingQuery } from '../queries/midi-recording-query';
import { EditorQuery, type IEditorQuery } from '../queries/editor-query';
import { AudioMonitorQuery, type IAudioMonitorQuery } from '../queries/audio-monitor-query';
import { ProjectCatalogQuery, type IProjectCatalogQuery } from '../queries/project-catalog-query';
import { PluginRuntimeQuery, type IPluginRuntimeQuery } from '../queries/plugin-runtime-query';
import { createBrowserCanPlayType, MediaSourceQuery, type IMediaSourceQuery } from '../queries/media-source-query';
import { RenderJobQuery, type IRenderJobQuery } from '../queries/render-job-query';
import { RuntimeDiagnosticsQuery, type IRuntimeDiagnosticsQuery } from '../queries/runtime-diagnostics-query';
import type { ILocalFirstProjectRepository } from '../project-repository/i-project-repository';
import { InMemoryProjectRepository } from '../project-repository/in-memory-project-repository';
import { IndexedDbProjectRepository } from '../project-repository/indexed-db-project-repository';
import {
  NoopProjectSyncService,
  type IProjectSyncService,
  type IRemoteProjectDocumentApplicator,
} from '../project-sync/i-project-sync';
import type { IPluginHost } from '../plugin-host/i-plugin-host';
import { PluginHost } from '../plugin-host/plugin-host';
import { createPluginCatalogEntry, type PluginManifest } from '../plugin-sdk/plugin-manifest.schema';
import { gainPluginManifest } from '../plugins/builtin/gain/gain-plugin-manifest';
import { saturationPluginManifest } from '../plugins/builtin/saturation/saturation-plugin-manifest';
import {
  PERMISSIVE_AUDIO_RUNTIME_ENVIRONMENT,
  resolveAudioRuntimeCapabilities,
  type AudioRuntimeCapabilities,
  type AudioRuntimeEnvironment,
} from '../shared/utils/audio-runtime-capabilities';
import type { ProjectDocumentSnapshot, ProjectMetadata } from '../shared/types/project-document.schema';
import type { PluginValidationResult } from '../shared/types/plugin-state';
import { BrowserMidiInput } from '../midi-input/browser-midi-input';
import type { IMidiInput } from '../midi-input/i-midi-input';
import type { IAuthClient } from '../auth/i-auth-client';
import { UnavailableAuthClient } from '../auth/unavailable-auth-client';
import type { IBillingClient } from '../billing/i-billing-client';
import { UnavailableBillingClient } from '../billing/unavailable-billing-client';

const NEW_PROJECT_NAME = '새 프로젝트';

export interface AppInstance {
  readonly authClient: IAuthClient;
  readonly billingClient: IBillingClient;
  readonly audioRuntimeCapabilities: AudioRuntimeCapabilities;
  readonly audioSourceResolver: IAudioSourceResolver;
  readonly audioSourceStager: IAudioSourceStager;
  readonly midiInput: IMidiInput;
  readonly session: ISessionQuery;
  readonly agentRuntimeCommands: IAgentRuntimeCommandExecutor;
  commandExecutor: CommandExecutor;
  commandHistory: ICommandHistoryQuery;
  playbackClock: IPlaybackClockQuery;
  meter: IMeterQuery;
  liveInput: ILiveInputQuery;
  recording: IRecordingQuery;
  midiRecording: IMidiRecordingQuery;
  editor: IEditorQuery;
  audioMonitor: IAudioMonitorQuery;
  projectCatalog: IProjectCatalogQuery;
  pluginRuntime: IPluginRuntimeQuery;
  mediaSource: IMediaSourceQuery;
  renderJob: IRenderJobQuery;
  runtimeDiagnostics: IRuntimeDiagnosticsQuery;
  readonly sessionRecovery?: ISessionRecoveryQuery;
}

interface ProjectSyncDependencies {
  readonly audioSourceRepository: IAudioSourceRepository;
  readonly projectRepository: ILocalFirstProjectRepository;
  readonly remoteProjectDocumentApplicator: IRemoteProjectDocumentApplicator;
}

export interface CreateAppOptions {
  authClient?: IAuthClient;
  billingClient?: IBillingClient;
  audioEngine?: IAudioEngine;
  audioSourceRegistry?: IAudioSourceRegistry;
  audioSourceRepository?: IAudioSourceRepository;
  projectRepository?: ILocalFirstProjectRepository;
  projectSync?: IProjectSyncService;
  createProjectSync?: (dependencies: ProjectSyncDependencies) => IProjectSyncService;
  audioRuntimeEnvironment?: AudioRuntimeEnvironment;
  initialProjectMetadata?: ProjectMetadata;
  initialPluginManifests?: readonly unknown[];
  midiInput?: IMidiInput;
  browserStorage?: Storage;
  sessionStore?: SessionStore;
}

interface InitialPluginRegistrationOptions {
  readonly availableManifestIds: readonly string[];
  readonly session: SessionStore;
  readonly pluginHost: IPluginHost;
  readonly pluginManifests: readonly unknown[];
}

function createNewProjectMetadata(): ProjectMetadata {
  return {
    id: globalThis.crypto.randomUUID(),
    name: NEW_PROJECT_NAME,
    revision: 0,
  };
}

function createAudioSourceCapabilities(audioSourceRegistry: IAudioSourceRegistry): {
  audioSourceResolver: IAudioSourceResolver;
  audioSourceStager: IAudioSourceStager;
} {
  return {
    audioSourceResolver: {
      resolve: sourceId => audioSourceRegistry.resolve(sourceId),
      listCommittedMetadata: () => audioSourceRegistry.listCommittedMetadata(),
    },
    audioSourceStager: {
      stage: registration => audioSourceRegistry.stage(registration),
      discardPending: sourceId => audioSourceRegistry.discardPending(sourceId),
    },
  };
}

function createCommandHistoryQuery(commandHistory: CommandHistory): ICommandHistoryQuery {
  return {
    getSnapshot: commandHistory.getSnapshot,
    subscribe: commandHistory.subscribe,
  };
}

function registerInitialPluginManifests({
  availableManifestIds,
  session,
  pluginHost,
  pluginManifests,
}: InitialPluginRegistrationOptions): void {
  const registeredManifests = pluginManifests.map(manifest => pluginHost.registerManifest(manifest));
  const availableManifestIdSet = new Set(availableManifestIds);
  const availableManifests = registeredManifests.filter(manifest => availableManifestIdSet.has(manifest.id));
  session.getState().replacePluginCatalogState({
    manifests: availableManifests.map(createPluginCatalogEntry),
    validationResults: registeredManifests.map(createValidManifestResult),
  });
}

function createValidManifestResult(manifest: PluginManifest): PluginValidationResult {
  return {
    manifestId: manifest.id,
    status: 'valid' as const,
    issues: [],
  };
}

class ProjectSyncServiceDelegate implements IProjectSyncService {
  private delegate: IProjectSyncService = new NoopProjectSyncService();

  setDelegate(delegate: IProjectSyncService): void {
    this.delegate = delegate;
  }

  activateProject(projectId: string): void {
    this.delegate.activateProject(projectId);
  }

  ensureLocalProjectMedia(document: ProjectDocumentSnapshot): Promise<void> {
    return this.delegate.ensureLocalProjectMedia(document);
  }

  ensureLocalProject(projectId: string): Promise<boolean> {
    return this.delegate.ensureLocalProject?.(projectId) ?? Promise.resolve(false);
  }

  listRemoteProjects() {
    return this.delegate.listRemoteProjects?.() ?? Promise.resolve([]);
  }

  notifyProjectChanged(projectId: string): void {
    this.delegate.notifyProjectChanged(projectId);
  }

  resume(): void {
    this.delegate.resume();
  }
}

function createDefaultAudioEngine(): IAudioEngine {
  const [gainParameter] = gainPluginManifest.parameters;
  const [saturationDriveParameter] = saturationPluginManifest.parameters;
  const liveAudioRuntime = new QuantizedLoopRuntime({
    liveAudioInput: new BrowserLiveAudioInput(),
    pcmCapture: new AudioWorkletPcmCapture(),
    playback: new ToneLoopPlaybackAdapter(),
  });
  const toneAudioRuntime = new AudioEngine({
    loopRuntime: liveAudioRuntime,
    recordingRuntime: liveAudioRuntime,
    pluginRuntimeFactories: [
      new ToneGainPluginRuntimeFactory({
        manifestId: gainPluginManifest.id,
        parameterId: gainParameter.id,
        minValue: gainParameter.minValue,
        maxValue: gainParameter.maxValue,
        defaultValue: gainParameter.defaultValue,
      }),
      new ToneSaturationPluginRuntimeFactory({
        manifestId: saturationPluginManifest.id,
        parameterId: saturationDriveParameter.id,
        minValue: saturationDriveParameter.minValue,
        maxValue: saturationDriveParameter.maxValue,
        defaultValue: saturationDriveParameter.defaultValue,
      }),
    ],
  });
  return new DawEngineAdapter({ runtime: toneAudioRuntime });
}

/**
 * Core Application Factory
 */
export function createApp(options: CreateAppOptions = {}): AppInstance {
  const initialProjectMetadata =
    options.sessionStore?.getState().project ?? options.initialProjectMetadata ?? createNewProjectMetadata();
  const session = options.sessionStore ?? createSessionStore({ initialProjectMetadata });
  const audioEngine = options.audioEngine ?? createDefaultAudioEngine();
  const audioSourceRegistry = options.audioSourceRegistry ?? new AudioSourceRegistry(new BrowserObjectUrlAdapter());
  const audioSourceRepository = options.audioSourceRepository ?? new OpfsAudioSourceRepository();
  const projectRepository = options.projectRepository ?? new IndexedDbProjectRepository();
  const projectSyncDelegate = new ProjectSyncServiceDelegate();
  const controllerProjectSync = options.projectSync ?? projectSyncDelegate;
  const pluginHost = new PluginHost();
  registerInitialPluginManifests({
    availableManifestIds: audioEngine.listAvailablePluginManifestIds(),
    session,
    pluginHost,
    pluginManifests: options.initialPluginManifests ?? [gainPluginManifest, saturationPluginManifest],
  });
  const audioSourceCapabilities = createAudioSourceCapabilities(audioSourceRegistry);
  const midiInput = options.midiInput ?? new BrowserMidiInput();
  const browserStorage = options.browserStorage;
  const undoJournal = new BrowserUndoJournal(browserStorage);
  const sessionRecovery = new BrowserSessionRecoveryStore(browserStorage);
  const controller = new AppController({
    sessionStore: session,
    audioEngine,
    audioSourceRegistry,
    audioSourceRepository,
    projectRepository,
    projectSync: controllerProjectSync,
    pluginHost,
    midiInput,
    onRemoteProjectReplaced: projectId => undoJournal.clear(projectId),
  });
  const projectSync =
    options.projectSync ??
    options.createProjectSync?.({
      audioSourceRepository,
      projectRepository,
      remoteProjectDocumentApplicator: controller.project,
    }) ??
    new NoopProjectSyncService();
  projectSyncDelegate.setDelegate(projectSync);
  const commandHistory = new CommandHistory();
  const audioRuntimeEnvironment = options.audioRuntimeEnvironment ?? readAudioRuntimeEnvironment();
  const audioRuntimeCapabilities = resolveAudioRuntimeCapabilities(
    audioRuntimeEnvironment,
    audioEngine.getFeatureSupport()
  );
  const commandExecutor = new CommandExecutor(
    session,
    controller,
    commandHistory,
    undoJournal,
    sessionRecovery,
    audioRuntimeCapabilities
  );
  const agentRuntimeCommands = new AgentRuntimeCommandExecutor(controller.agentRuntime);
  const sessionQuery = createSessionQuery(session);
  const commandHistoryQuery = createCommandHistoryQuery(commandHistory);
  const playbackClock = new PlaybackClockQuery(controller.playback);
  const meter = new MeterQuery(controller.meter);
  const liveInput = new LiveInputQuery(controller.liveInput);
  const recording = new RecordingQuery(controller.recording);
  const midiRecording = new MidiRecordingQuery(controller.midi);
  const editor = new EditorQuery(controller.editor);
  const audioMonitor = new AudioMonitorQuery(audioEngine);
  const projectCatalog = new ProjectCatalogQuery(projectRepository, projectSync);
  const pluginRuntime = new PluginRuntimeQuery(audioEngine);
  const mediaSource = new MediaSourceQuery({
    audioSourceResolver: audioSourceCapabilities.audioSourceResolver,
    canPlayType: createBrowserCanPlayType(),
  });
  const renderJob = new RenderJobQuery(audioEngine);
  const runtimeDiagnostics = new RuntimeDiagnosticsQuery({ audioEngine });
  const authClient = options.authClient ?? new UnavailableAuthClient();
  const billingClient = options.billingClient ?? new UnavailableBillingClient();
  projectSync.activateProject(initialProjectMetadata.id);

  return {
    authClient,
    billingClient,
    audioRuntimeCapabilities,
    ...audioSourceCapabilities,
    session: sessionQuery,
    agentRuntimeCommands,
    commandExecutor,
    commandHistory: commandHistoryQuery,
    midiInput,
    meter,
    liveInput,
    recording,
    midiRecording,
    editor,
    audioMonitor,
    playbackClock,
    projectCatalog,
    pluginRuntime,
    mediaSource,
    renderJob,
    runtimeDiagnostics,
    sessionRecovery,
  };
}

export function createCliTestApp(
  options: Pick<CreateAppOptions, 'audioRuntimeEnvironment' | 'sessionStore'> = {}
): AppInstance {
  return createApp({
    ...options,
    audioEngine: new MockAudioEngine(),
    audioRuntimeEnvironment: options.audioRuntimeEnvironment ?? PERMISSIVE_AUDIO_RUNTIME_ENVIRONMENT,
    projectRepository: new InMemoryProjectRepository(),
  });
}
