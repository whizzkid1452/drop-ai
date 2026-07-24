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
    this.sessionStore.getState().stopPlayback();
  }

  handlePause(): void {
    console.log('[PlaybackController] Handling Pause Request');

    // 1. Command Audio Engine
    this.audioEngine.pause();
    const currentTime = this.audioEngine.getCurrentTime();

    // 2. Update Session State
    this.sessionStore.getState().pausePlayback(currentTime);
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

    // Region 좌표가 절대 초이므로 BPM으로 기존 예약 시점을 바꾸지 않는다.
    this.sessionStore.getState().setTempo(tempo);
  }

  getCurrentTime(): number {
    return this.audioEngine.getCurrentTime();
  }
}
