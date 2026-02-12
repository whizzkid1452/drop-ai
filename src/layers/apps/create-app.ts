import { type IAudioEngine } from '@/layers/audio-engine';
import { createSessionStore, type SessionStore } from '@/layers/session';
import { AppController } from '@/layers/controllers';

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
