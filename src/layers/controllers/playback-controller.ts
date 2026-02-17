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

  handleSeek(time: number): void {
    console.log(`[PlaybackController] Handling Seek Request: ${time}s`);
    this.audioEngine.seekTo(time);
  }

  handleLoop(start: number, end: number, isLooping: boolean): void {
    if (isLooping) {
      console.log(`[PlaybackController] Set Loop: ${start} -> ${end}`);
      this.audioEngine.setLoopPoints(start, end);
      this.audioEngine.setLoop(true);
      this.sessionStore.getState().setLoopPoints(start, end);
      this.sessionStore.getState().setLoop(true);
    } else {
      console.log('[PlaybackController] Loop Off');
      this.audioEngine.setLoop(false);
      this.sessionStore.getState().setLoop(false);
    }
  }

  handleBpm(bpm: number): void {
    console.log(`[PlaybackController] Set BPM: ${bpm}`);
    this.audioEngine.setBpm(bpm);
    this.sessionStore.getState().setBpm(bpm);
  }

  handleMasterVolume(volume: number): void {
    console.log(`[PlaybackController] Set Master Volume: ${volume}`);
    this.audioEngine.setVolume(volume);
    this.sessionStore.getState().setMasterVolume(volume);
  }
}
