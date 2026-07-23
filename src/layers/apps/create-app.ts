import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import { AudioEngine } from '../audio-engine/audio-engine';
import { readAudioRuntimeEnvironment } from '../audio-engine/audio-runtime-environment';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
import { ToneGainPluginRuntimeFactory } from '../audio-engine/plugins/tone-gain-plugin-runtime';
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
import { AppController } from '../controllers/app-controller';
import { CommandExecutor } from '../commands/command-executor';
import { CommandHistory, type ICommandHistoryQuery } from '../commands/command-history';
import { PlaybackClockQuery, type IPlaybackClockQuery } from '../queries/playback-clock-query';
import { ProjectCatalogQuery, type IProjectCatalogQuery } from '../queries/project-catalog-query';
import type { IProjectRepository } from '../project-repository/i-project-repository';
import { InMemoryProjectRepository } from '../project-repository/in-memory-project-repository';
import { IndexedDbProjectRepository } from '../project-repository/indexed-db-project-repository';
import type { IPluginHost } from '../plugin-host/i-plugin-host';
import { PluginHost } from '../plugin-host/plugin-host';
import { createPluginManifestSummary, type PluginManifest } from '../plugin-sdk/plugin-manifest.schema';
import { gainPluginManifest } from '../plugins/builtin/gain/gain-plugin-manifest';
import {
  resolveAudioRuntimeCapabilities,
  type AudioRuntimeCapabilities,
  type AudioRuntimeEnvironment,
} from '../shared/utils/audio-runtime-capabilities';
import type { ProjectMetadata } from '../shared/types/project-document.schema';
import type { PluginValidationResult } from '../shared/types/plugin-state';

const NEW_PROJECT_NAME = '새 프로젝트';

export interface AppInstance {
  readonly audioRuntimeCapabilities: AudioRuntimeCapabilities;
  readonly audioSourceResolver: IAudioSourceResolver;
  readonly audioSourceStager: IAudioSourceStager;
  session: SessionStore;
  commandExecutor: CommandExecutor;
  commandHistory: ICommandHistoryQuery;
  playbackClock: IPlaybackClockQuery;
  projectCatalog: IProjectCatalogQuery;
}

export interface CreateAppOptions {
  audioEngine?: IAudioEngine;
  audioSourceRegistry?: IAudioSourceRegistry;
  audioSourceRepository?: IAudioSourceRepository;
  projectRepository?: IProjectRepository;
  audioRuntimeEnvironment?: AudioRuntimeEnvironment;
  initialProjectMetadata?: ProjectMetadata;
  initialPluginManifests?: readonly unknown[];
}

interface InitialPluginRegistrationOptions {
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
  session,
  pluginHost,
  pluginManifests,
}: InitialPluginRegistrationOptions): void {
  const registeredManifests = pluginManifests.map(manifest => pluginHost.registerManifest(manifest));
  session.getState().replacePluginCatalogState({
    manifests: registeredManifests.map(createPluginManifestSummary),
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

function createDefaultAudioEngine(): IAudioEngine {
  const [gainParameter] = gainPluginManifest.parameters;
  return new AudioEngine({
    pluginRuntimeFactories: [
      new ToneGainPluginRuntimeFactory({
        manifestId: gainPluginManifest.id,
        parameterId: gainParameter.id,
        minValue: gainParameter.minValue,
        maxValue: gainParameter.maxValue,
        defaultValue: gainParameter.defaultValue,
      }),
    ],
  });
}

/**
 * Core Application Factory
 */
export function createApp(options: CreateAppOptions = {}): AppInstance {
  const initialProjectMetadata = options.initialProjectMetadata ?? createNewProjectMetadata();
  const session = createSessionStore({ initialProjectMetadata });
  const audioEngine = options.audioEngine ?? createDefaultAudioEngine();
  const audioSourceRegistry = options.audioSourceRegistry ?? new AudioSourceRegistry(new BrowserObjectUrlAdapter());
  const audioSourceRepository = options.audioSourceRepository ?? new OpfsAudioSourceRepository();
  const projectRepository = options.projectRepository ?? new IndexedDbProjectRepository();
  const pluginHost = new PluginHost();
  registerInitialPluginManifests({
    session,
    pluginHost,
    pluginManifests: options.initialPluginManifests ?? [gainPluginManifest],
  });
  const audioSourceCapabilities = createAudioSourceCapabilities(audioSourceRegistry);
  const controller = new AppController({
    sessionStore: session,
    audioEngine,
    audioSourceRegistry,
    audioSourceRepository,
    projectRepository,
    pluginHost,
  });
  const commandHistory = new CommandHistory();
  const commandExecutor = new CommandExecutor(session, controller, commandHistory);
  const commandHistoryQuery = createCommandHistoryQuery(commandHistory);
  const playbackClock = new PlaybackClockQuery(controller.playback);
  const projectCatalog = new ProjectCatalogQuery(projectRepository);
  const audioRuntimeEnvironment = options.audioRuntimeEnvironment ?? readAudioRuntimeEnvironment();
  const audioRuntimeCapabilities = resolveAudioRuntimeCapabilities(audioRuntimeEnvironment);

  return {
    audioRuntimeCapabilities,
    ...audioSourceCapabilities,
    session,
    commandExecutor,
    commandHistory: commandHistoryQuery,
    playbackClock,
    projectCatalog,
  };
}

export function createCliTestApp(): AppInstance {
  return createApp({ audioEngine: new MockAudioEngine(), projectRepository: new InMemoryProjectRepository() });
}
