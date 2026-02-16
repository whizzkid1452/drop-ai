import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import { type SessionStore } from '../session/session';

export class TrackController {
  constructor(
    private sessionStore: SessionStore,
    private audioEngine: IAudioEngine
  ) {}
  // id를 내부에서 반환하도록 처리
  async addTrack() {
    const id = crypto.randomUUID();
    console.log(`[TrackController] Adding track: ${id}`);

    // 2. Update Session via Zustand
    this.sessionStore.getState().addTrack({
      id,
      volume: 1.0,
      isMuted: false,
      isSoloed: false,
    });

    return { id };
  }

  async createTrackFromFile(file: File) {
    const id = crypto.randomUUID();
    console.log(`[TrackController] Creating track from file: ${id}`);

    const { src } = await this.audioEngine.loadFile(file);
    console.log(`[TrackController] Track file loaded: ${src}`);

    this.sessionStore.getState().addTrack({
      id,
      volume: 1.0,
      isMuted: false,
      isSoloed: false,
    });

    return { id };
  }

  async updateTrackSourceFromFile(trackId: string, file: File) {
    console.log(
      `[TrackController] Updating track source from file: ${trackId}`
    );
    const { src } = await this.audioEngine.loadFile(file);
    // trackId에 연결해야함
    console.log(`[TrackController] Track source updated: ${src}`);
  }

  removeTrack(id: string): void {
    console.log(`[TrackController] Removing track: ${id}`);
    this.sessionStore.getState().removeTrack(id);
  }

  setTrackVolume(id: string, volume: number): void {
    this.sessionStore.getState().updateTrack(id, { volume });
  }
}
