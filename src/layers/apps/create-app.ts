import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import { createSessionStore, type SessionStore } from '../session/session';
import { AppController } from '../controllers/app-controller';

export interface AppInstance {
  session: SessionStore;
  controller: AppController;
}

/**
 * Core Application Factory
 */
export function createApp(audioEngine: IAudioEngine): AppInstance {
  const session = createSessionStore();
  const controller = new AppController(session, audioEngine);

  return { session, controller };
}
