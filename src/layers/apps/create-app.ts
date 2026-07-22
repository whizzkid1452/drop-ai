import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import { AudioEngine } from '../audio-engine/audio-engine';
import { createSessionStore, type SessionStore } from '../session/session';
import { AppController } from '../controllers/app-controller';
import { CommandExecutor } from '../commands/command-executor';

export interface AppInstance {
  session: SessionStore;
  controller: AppController;
  commandExecutor: CommandExecutor;
}

export interface CreateAppOptions {
  audioEngine?: IAudioEngine;
}

/**
 * Core Application Factory
 */
export function createApp(options: CreateAppOptions = {}): AppInstance {
  const session = createSessionStore();
  const audioEngine = options.audioEngine ?? new AudioEngine();
  const controller = new AppController(session, audioEngine);
  const commandExecutor = new CommandExecutor(session, controller);

  return { session, controller, commandExecutor };
}
