import { AudioEngine } from './audio-engine/audio-engine';
import { Session } from './session/session';
import { AppController } from './controllers/app-controller';

/**
 * Main Factory (Composition Root)
 * 
 * Responsible for wiring up the entire application.
 * This file is the only place allowed to import all layers.
 */

export function createConsoleApp() {
    // 1. Create Engine (Implementation Detail)
    const engine = new AudioEngine();

    // 2. Create Session (Pure State)
    const session = new Session();

    // 3. Create Controller (Orchestrator, Injects Engine & Session)
    const controller = new AppController(session, engine);

    return { controller, session };
}
