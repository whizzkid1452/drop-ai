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
      pan: 0,
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

  moveRegion(trackId: string, regionId: string, newStartTime: number) {
    console.log(
      `[TrackController] Moving region: ${regionId} to ${newStartTime}s`
    );

    const track = this.sessionStore.getState().tracks.get(trackId);
    const region = track?.regions.find(r => r.id === regionId);

    if (!region) {
      console.warn(`[TrackController] Region not found: ${regionId}`);
      return;
    }

    // Audio Engine 업데이트 (moveRegion 활용)
    this.audioEngine.moveRegion(trackId, regionId, newStartTime);

    const updatedRegion = { ...region, startTime: newStartTime };

    if (track) {
      this.sessionStore.getState().updateTrack(trackId, {
        regions: track.regions.map(r =>
          r.id === regionId ? updatedRegion : r
        ),
      });
    }
  }

  removeRegion(trackId: string, regionId: string) {
    console.log(`[TrackController] Removing region: ${regionId}`);
    this.audioEngine.removeRegion(trackId, regionId);
    this.sessionStore.getState().removeRegion(trackId, regionId);
  }

  splitRegion(trackId: string, regionId: string, splitTime: number) {
    const track = this.sessionStore.getState().tracks.get(trackId);
    if (!track) {
      throw new Error(`Track ${trackId} not found`);
    }

    const region = track.regions.find(r => r.id === regionId);
    if (!region) {
      throw new Error(`Region ${regionId} not found in track ${trackId}`);
    }

    if (
      splitTime <= region.startTime ||
      splitTime >= region.startTime + region.duration
    ) {
      throw new Error('Split time must be within region duration');
    }

    console.log(
      `[TrackController] Splitting region: ${regionId} at ${splitTime}s`
    );

    const splitOffset = region.offset + (splitTime - region.startTime);
    const leftDuration = splitTime - region.startTime;
    const rightDuration = region.duration - leftDuration;

    // 1. Resize original region (Left)
    this.resizeRegion(trackId, regionId, leftDuration);

    // 2. Create Right Region
    const rightRegion = {
      ...region,
      id: crypto.randomUUID(),
      startTime: splitTime,
      offset: splitOffset,
      duration: rightDuration,
    };

    // 3. Add Right Region
    this.audioEngine.addRegion(trackId, rightRegion);
    this.sessionStore.getState().addRegion(trackId, rightRegion);

    return { leftId: regionId, rightId: rightRegion.id };
  }

  resizeRegion(trackId: string, regionId: string, newDuration: number) {
    const track = this.sessionStore.getState().tracks.get(trackId);
    if (!track) {
      throw new Error(`Track ${trackId} not found`);
    }

    const region = track.regions.find(r => r.id === regionId);

    if (!region) {
      throw new Error(`Region ${regionId} not found`);
    }

    if (newDuration <= 0) {
      throw new Error('Duration must be positive');
    }

    console.log(
      `[TrackController] Resizing region: ${regionId} to ${newDuration}s`
    );

    // Update Session
    this.sessionStore
      .getState()
      .updateRegion(trackId, regionId, { duration: newDuration });

    // Update AudioEngine
    // Reuse remove/add pattern
    const newRegion = { ...region, duration: newDuration };
    this.audioEngine.removeRegion(trackId, regionId);
    this.audioEngine.addRegion(trackId, newRegion);
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

  setTrackPan(id: string, pan: number): void {
    this.audioEngine.setTrackPan(id, pan);
    this.sessionStore.getState().updateTrack(id, { pan });
  }
}
