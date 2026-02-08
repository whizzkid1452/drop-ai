import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import { Session } from '../session/session';
import { AppController } from '../controllers/app-controller';

export interface AppInstance {
    session: Session;
    controller: AppController;
}

/**
 * Core Application Factory
 * 
 * Assembles the core layers (Session, Controller) using a provided AudioEngine.
 * This allows different apps (CLI, Web, Agent) to inject their specific environment's engine
 * while sharing the same business logic wiring.
 */
export function createApp(audioEngine: IAudioEngine): AppInstance {
    const session = new Session(); // Session is now pure
    const controller = new AppController(session, audioEngine);

    return { session, controller };
}
