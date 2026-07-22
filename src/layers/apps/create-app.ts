import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import { AudioEngine } from '../audio-engine/audio-engine';
import { readAudioRuntimeEnvironment } from '../audio-engine/audio-runtime-environment';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
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
import { PlaybackClockQuery, type IPlaybackClockQuery } from '../queries/playback-clock-query';
import type { IProjectRepository } from '../project-repository/i-project-repository';
import { InMemoryProjectRepository } from '../project-repository/in-memory-project-repository';
import { IndexedDbProjectRepository } from '../project-repository/indexed-db-project-repository';
import {
  resolveAudioRuntimeCapabilities,
  type AudioRuntimeCapabilities,
  type AudioRuntimeEnvironment,
} from '../shared/utils/audio-runtime-capabilities';
import type { ProjectMetadata } from '../shared/types/project-document.schema';

const NEW_PROJECT_NAME = '새 프로젝트';

export interface AppInstance {
  readonly audioRuntimeCapabilities: AudioRuntimeCapabilities;
  readonly audioSourceResolver: IAudioSourceResolver;
  readonly audioSourceStager: IAudioSourceStager;
  session: SessionStore;
  commandExecutor: CommandExecutor;
  playbackClock: IPlaybackClockQuery;
}

export interface CreateAppOptions {
  audioEngine?: IAudioEngine;
  audioSourceRegistry?: IAudioSourceRegistry;
  audioSourceRepository?: IAudioSourceRepository;
  projectRepository?: IProjectRepository;
  audioRuntimeEnvironment?: AudioRuntimeEnvironment;
  initialProjectMetadata?: ProjectMetadata;
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

/**
 * Core Application Factory
 */
export function createApp(options: CreateAppOptions = {}): AppInstance {
  const initialProjectMetadata = options.initialProjectMetadata ?? createNewProjectMetadata();
  const session = createSessionStore({ initialProjectMetadata });
  const audioEngine = options.audioEngine ?? new AudioEngine();
  const audioSourceRegistry = options.audioSourceRegistry ?? new AudioSourceRegistry(new BrowserObjectUrlAdapter());
  const audioSourceRepository = options.audioSourceRepository ?? new OpfsAudioSourceRepository();
  const projectRepository = options.projectRepository ?? new IndexedDbProjectRepository();
  const audioSourceCapabilities = createAudioSourceCapabilities(audioSourceRegistry);
  const controller = new AppController({
    sessionStore: session,
    audioEngine,
    audioSourceRegistry,
    audioSourceRepository,
    projectRepository,
  });
  const commandExecutor = new CommandExecutor(session, controller);
  const playbackClock = new PlaybackClockQuery(controller.playback);
  const audioRuntimeEnvironment = options.audioRuntimeEnvironment ?? readAudioRuntimeEnvironment();
  const audioRuntimeCapabilities = resolveAudioRuntimeCapabilities(audioRuntimeEnvironment);

  return {
    audioRuntimeCapabilities,
    ...audioSourceCapabilities,
    session,
    commandExecutor,
    playbackClock,
  };
}

export function createCliTestApp(): AppInstance {
  return createApp({ audioEngine: new MockAudioEngine(), projectRepository: new InMemoryProjectRepository() });
}
