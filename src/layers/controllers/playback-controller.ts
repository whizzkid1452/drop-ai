import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import { type SessionStore } from '../session/session';

export class PlaybackController {
  constructor(
    private sessionStore: SessionStore,
    private audioEngine: IAudioEngine
  ) {}

  async handlePlay(): Promise<void> {
    console.log('[PlaybackController] Handling Play Request');

    // 1. Command Audio Engine
    await this.audioEngine.play();

    // 2. Update Session State via Zustand Actions
    this.sessionStore.getState().setPlaying(true);
  }

  handleStop(): void {
    console.log('[PlaybackController] Handling Stop Request');

    // 1. Command Audio Engine
    this.audioEngine.stop();

    // 2. Update Session State
    this.sessionStore.getState().setPlaying(false);
  }

  handlePause(): void {
    console.log('[PlaybackController] Handling Pause Request');

    // 1. Command Audio Engine
    this.audioEngine.pause();

    // 2. Update Session State
    this.sessionStore.getState().setPlaying(false);
  }
}
