import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import type { SessionStore, TrackState } from '../session/session';
import { ProjectStateError, ProjectStateErrorCode } from './project-state-error';

export class TrackController {
  constructor(
    private sessionStore: SessionStore,
    private audioEngine: IAudioEngine
  ) {}

  async addTrack(url: string, id: string): Promise<void> {
    console.log(`[TrackController] Adding track: ${id}`);

    this.throwIfTrackExists(id);
    await this.audioEngine.loadTrack(url, id);
    this.throwIfTrackExists(id);

    this.sessionStore.getState().addTrack({
      id,
      name: `Track ${id}`,
      volume: 1.0,
      pan: 0,
      isMuted: false,
      isSoloed: false,
      status: [],
      regions: [],
    });
  }

  removeTrack(id: string): void {
    console.log(`[TrackController] Removing track: ${id}`);

    this.getTrackOrThrow(id);
    this.audioEngine.removeTrack(id);
    this.sessionStore.getState().removeTrack(id);
  }

  setVolume(trackId: string, volume: number): void {
    console.log(`[TrackController] Setting volume for ${trackId}: ${volume}`);

    this.getTrackOrThrow(trackId);
    this.audioEngine.setTrackVolume(trackId, volume);
    this.sessionStore.getState().updateTrack(trackId, { volume });
  }

  setPan(trackId: string, pan: number): void {
    console.log(`[TrackController] Setting pan for ${trackId}: ${pan}`);

    this.getTrackOrThrow(trackId);
    this.audioEngine.setTrackPan(trackId, pan);
    this.sessionStore.getState().updateTrack(trackId, { pan });
  }

  setMute(trackId: string, muted: boolean): void {
    console.log(`[TrackController] Setting mute for ${trackId}: ${muted}`);

    this.getTrackOrThrow(trackId);
    this.audioEngine.setTrackMute(trackId, muted);
    this.sessionStore.getState().updateTrack(trackId, { isMuted: muted });
  }

  setSolo(trackId: string, soloed: boolean): void {
    console.log(`[TrackController] Setting solo for ${trackId}: ${soloed}`);

    this.getTrackOrThrow(trackId);
    this.audioEngine.setTrackSolo(trackId, soloed);
    this.sessionStore.getState().updateTrack(trackId, { isSoloed: soloed });
  }

  private getTrackOrThrow(trackId: string): TrackState {
    const track = this.sessionStore.getState().tracks.get(trackId);
    if (track) {
      return track;
    }

    throw new ProjectStateError(ProjectStateErrorCode.TRACK_NOT_FOUND, `트랙을 찾을 수 없습니다: ${trackId}`, {
      trackId,
    });
  }

  private throwIfTrackExists(trackId: string): void {
    if (!this.sessionStore.getState().tracks.has(trackId)) {
      return;
    }

    throw new ProjectStateError(ProjectStateErrorCode.TRACK_ID_CONFLICT, `이미 사용 중인 Track ID입니다: ${trackId}`, {
      trackId,
    });
  }
}
