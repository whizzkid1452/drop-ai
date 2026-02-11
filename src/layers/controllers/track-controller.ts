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
      pan: 0,
      isMuted: false,
      isSoloed: false,
      regions: [],
    });
  }

  removeTrack(id: string): void {
    console.log(`[TrackController] Removing track: ${id}`);
    this.sessionStore.getState().removeTrack(id);
  }

  setVolume(trackId: string, volume: number): void {
    console.log(`[TrackController] Setting volume for ${trackId}: ${volume}`);
    
    // 1. AudioEngine을 통해 오디오 업데이트
    this.audioEngine.setTrackVolume(trackId, volume);
    
    // 2. SessionStore도 명시적으로 업데이트 (MockAudioEngine에서는 SessionStore가 없으므로)
    this.sessionStore.getState().updateTrack(trackId, { volume });
  }

  setPan(trackId: string, pan: number): void {
    console.log(`[TrackController] Setting pan for ${trackId}: ${pan}`);
    
    // 1. AudioEngine을 통해 오디오 업데이트
    this.audioEngine.setTrackPan(trackId, pan);
    
    // 2. SessionStore도 명시적으로 업데이트 (MockAudioEngine에서는 SessionStore가 없으므로)
    this.sessionStore.getState().updateTrack(trackId, { pan });
  }

  setMute(trackId: string, muted: boolean): void {
    console.log(`[TrackController] Setting mute for ${trackId}: ${muted}`);
    
    // SessionStore 업데이트
    this.sessionStore.getState().updateTrack(trackId, { isMuted: muted });
  }

  setSolo(trackId: string, soloed: boolean): void {
    console.log(`[TrackController] Setting solo for ${trackId}: ${soloed}`);
    
    // SessionStore 업데이트
    this.sessionStore.getState().updateTrack(trackId, { isSoloed: soloed });
  }
}
