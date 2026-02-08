import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import { Session } from '../session/session';
import { PlaybackController } from './playback-controller';

/**
 * Controller Facade
 * 
 * Aggregates all controllers into a single access point.
 * This simplifies the application wiring and provides a unified interface for the UI.
 */
export class AppController {
    public readonly playback: PlaybackController;

    constructor(session: Session, audioEngine: IAudioEngine) {
        this.playback = new PlaybackController(session, audioEngine);
    }
}
