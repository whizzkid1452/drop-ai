import { type IAudioEngine } from '@/layers/audio-engine';
import { type SessionStore } from '@/layers/session';

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

  handleSeek(time: number): void {
    console.log(`[PlaybackController] Seeking to ${time}`);

    // Command Audio Engine
    this.audioEngine.setTime(time);
    
    // Update Session State
    this.sessionStore.getState().setCurrentTime(time);
  }

  handleSetTempo(tempo: number): void {
    console.log(`[PlaybackController] Setting tempo to ${tempo}`);

    // Command Audio Engine
    this.audioEngine.setTempo(tempo);

    // Update Session State
    this.sessionStore.getState().setTempo(tempo);
  }

  getCurrentTime(): number {
    return this.audioEngine.getCurrentTime();
  }
}
