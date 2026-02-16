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

    // 1. AudioEngine에서 트랙(채널) 미리 생성
    this.audioEngine.createTrack(id);

    // 2. Update Session via Zustand
    this.sessionStore.getState().addTrack({
      id,
      name: `Track ${id.slice(0, 4)}`, // Default name
      volume: 1.0,
      isMuted: false,
      isSoloed: false,
      regions: [],
    });

    return { id };
  }

  async addRegion(trackId: string, file: File, startTime: number) {
    const regionId = crypto.randomUUID();
    console.log(`[TrackController] Adding region: ${regionId} to ${trackId}`);

    // 1. Load file and get duration
    const { src, duration } = await this.audioEngine.loadFile(file);

    const region = {
      id: regionId,
      trackId,
      src,
      startTime,
      duration,
      offset: 0,
    };

    // 2. Add to AudioEngine
    this.audioEngine.addRegion(trackId, region);

    // 3. Update Session
    this.sessionStore.getState().addRegion(trackId, region);

    return { regionId };
  }

  removeRegion(trackId: string, regionId: string) {
    console.log(`[TrackController] Removing region: ${regionId}`);
    this.audioEngine.removeRegion(trackId, regionId);
    this.sessionStore.getState().removeRegion(trackId, regionId);
  }

  removeTrack(id: string): void {
    console.log(`[TrackController] Removing track: ${id}`);
    this.audioEngine.removeTrack(id);
    this.sessionStore.getState().removeTrack(id);
  }

  setTrackVolume(id: string, volume: number): void {
    this.audioEngine.setTrackVolume(id, volume);
    this.sessionStore.getState().updateTrack(id, { volume });
  }

  setTrackMute(id: string, isMuted: boolean): void {
    this.audioEngine.setTrackMute(id, isMuted);
    this.sessionStore.getState().updateTrack(id, { isMuted });
  }

  setTrackSolo(id: string, isSoloed: boolean): void {
    this.audioEngine.setTrackSolo(id, isSoloed);
    this.sessionStore.getState().updateTrack(id, { isSoloed });
  }
}
