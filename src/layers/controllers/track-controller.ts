import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import { type SessionStore } from '../session/session';

export class TrackController {
  constructor(
    private sessionStore: SessionStore,
    private audioEngine: IAudioEngine
  ) {}

  async addTrack(url: string, id: string): Promise<void> {
    console.log(`[TrackController] Adding track: ${id}`);

    // 1. Audio Engine Load
    await this.audioEngine.loadTrack(url, id);

    // 2. Update Session via Zustand
    this.sessionStore.getState().addTrack({
      id,
      volume: 1.0,
      isMuted: false,
      isSoloed: false,
    });
  }

  removeTrack(id: string): void {
    console.log(`[TrackController] Removing track: ${id}`);
    this.sessionStore.getState().removeTrack(id);
  }

  setTrackVolume(id: string, volume: number): void {
    this.sessionStore.getState().updateTrack(id, { volume });
  }
}
