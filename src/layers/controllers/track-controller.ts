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
      volume: 1.0,
      isMuted: false,
      isSoloed: false,
      src: null,
    });

    return { id };
  }

  async createTrackFromFile(file: File) {
    const id = crypto.randomUUID();
    console.log(`[TrackController] Creating track from file: ${id}`);

    const { src } = await this.audioEngine.loadFile(file);
    console.log(`[TrackController] Track file loaded: ${src}`);

    // AudioEngine에서 트랙 생성 및 소스 연결
    this.audioEngine.createTrack(id);
    await this.audioEngine.setTrackSource(id, src);

    this.sessionStore.getState().addTrack({
      id,
      volume: 1.0,
      isMuted: false,
      isSoloed: false,
      src,
    });

    return { id };
  }

  async updateTrackSourceFromFile(trackId: string, file: File) {
    console.log(
      `[TrackController] Updating track source from file: ${trackId}`
    );
    const { src } = await this.audioEngine.loadFile(file);

    // AudioEngine에 Source 연결
    await this.audioEngine.setTrackSource(trackId, src);

    // Session 업데이트 (src 추가됨)
    this.sessionStore.getState().updateTrack(trackId, { src });

    console.log(`[TrackController] Track source updated: ${src}`);
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
