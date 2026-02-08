import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import { Session } from '../session/session';

export class PlaybackController {
    constructor(
        private session: Session,
        private audioEngine: IAudioEngine
    ) { }

    async handlePlay(): Promise<void> {
        console.log('[PlaybackController] Handling Play Request');

        // 1. Command Audio Engine
        await this.audioEngine.play();

        // 2. Update Session State
        this.session.setPlaying(true);
    }

    handleStop(): void {
        console.log('[PlaybackController] Handling Stop Request');

        // 1. Command Audio Engine
        this.audioEngine.stop();

        // 2. Update Session State
        this.session.setPlaying(false);
    }

    handlePause(): void {
        console.log('[PlaybackController] Handling Pause Request');

        // 1. Command Audio Engine
        this.audioEngine.pause();

        // 2. Update Session State
        this.session.setPlaying(false);
    }
}
