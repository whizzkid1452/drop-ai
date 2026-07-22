import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import { AudioEngine } from '../audio-engine/audio-engine';
import { readAudioRuntimeEnvironment } from '../audio-engine/audio-runtime-environment';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
import { createSessionStore, type SessionStore } from '../session/session';
import { AppController } from '../controllers/app-controller';
import { CommandExecutor } from '../commands/command-executor';
import { PlaybackClockQuery, type IPlaybackClockQuery } from '../queries/playback-clock-query';
import {
  resolveAudioRuntimeCapabilities,
  type AudioRuntimeCapabilities,
  type AudioRuntimeEnvironment,
} from '../shared/utils/audio-runtime-capabilities';
import type { ProjectMetadata } from '../shared/types/project-document.schema';

const NEW_PROJECT_NAME = '새 프로젝트';

export interface AppInstance {
  readonly audioRuntimeCapabilities: AudioRuntimeCapabilities;
  session: SessionStore;
  commandExecutor: CommandExecutor;
  playbackClock: IPlaybackClockQuery;
}

export interface CreateAppOptions {
  audioEngine?: IAudioEngine;
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

/**
 * Core Application Factory
 */
export function createApp(options: CreateAppOptions = {}): AppInstance {
  const initialProjectMetadata = options.initialProjectMetadata ?? createNewProjectMetadata();
  const session = createSessionStore({ initialProjectMetadata });
  const audioEngine = options.audioEngine ?? new AudioEngine();
  const controller = new AppController(session, audioEngine);
  const commandExecutor = new CommandExecutor(session, controller);
  const playbackClock = new PlaybackClockQuery(controller.playback);
  const audioRuntimeEnvironment = options.audioRuntimeEnvironment ?? readAudioRuntimeEnvironment();
  const audioRuntimeCapabilities = resolveAudioRuntimeCapabilities(audioRuntimeEnvironment);

  return { audioRuntimeCapabilities, session, commandExecutor, playbackClock };
}

export function createCliTestApp(): AppInstance {
  return createApp({ audioEngine: new MockAudioEngine() });
}
