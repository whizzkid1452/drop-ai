import { AudioEngineError, AudioEngineErrorCode, ERROR_MESSAGES } from './errors';
import type {
  ExportRequest,
  IAudioEngine,
  RegionData,
  ReplaceRegionRequest,
  RescheduleRegionRequest,
} from './i-audio-engine';

interface MockTrackState {
  muted: boolean;
  pan: number;
  soloed: boolean;
  volume: number;
}

export class MockAudioEngine implements IAudioEngine {
  private mockTime = 0;
  private mockTracks: Map<string, MockTrackState> = new Map();
  private mockRegions: Map<string, Map<string, RegionData>> = new Map();

  async play(): Promise<void> {
    console.log('[MockAudioEngine] Playing...');
  }

  pause(): void {
    console.log('[MockAudioEngine] Paused.');
  }

  stop(): void {
    console.log('[MockAudioEngine] Stopped.');
    this.mockTime = 0;
  }

  setTime(time: number): void {
    this.mockTime = time;
    console.log(`[MockAudioEngine] Time set to: ${time}`);
  }

  getCurrentTime(): number {
    return this.mockTime;
  }

  async addTrack(trackId: string): Promise<void> {
    this.initializeTrack(trackId);
    console.log(`[MockAudioEngine] Track added: ${trackId}`);
  }

  removeTrack(trackId: string): void {
    this.mockTracks.delete(trackId);
    this.mockRegions.delete(trackId);
    console.log(`[MockAudioEngine] Track ${trackId} removed`);
  }

  setTrackVolume(trackId: string, volume: number): void {
    this.initializeTrack(trackId);
    const track = this.mockTracks.get(trackId);
    if (track) {
      track.volume = volume;
    }
    console.log(`[MockAudioEngine] Track ${trackId} volume set to: ${volume}`);
  }

  setTrackPan(trackId: string, pan: number): void {
    this.initializeTrack(trackId);
    const track = this.mockTracks.get(trackId);
    if (track) {
      track.pan = pan;
    }
    console.log(`[MockAudioEngine] Track ${trackId} pan set to: ${pan}`);
  }

  setTrackMute(trackId: string, muted: boolean): void {
    this.getTrack(trackId).muted = muted;
  }

  setTrackSolo(trackId: string, soloed: boolean): void {
    this.getTrack(trackId).soloed = soloed;
  }

  getTrackParams(trackId: string): { volume: number; pan: number } | null {
    console.log(`[MockAudioEngine] Getting params for track: ${trackId}`);
    const track = this.mockTracks.get(trackId);
    if (!track) {
      return null;
    }
    return { volume: track.volume, pan: track.pan };
  }

  async addRegion(trackId: string, regionData: RegionData): Promise<void> {
    this.initializeTrack(trackId);
    const trackRegions = this.mockRegions.get(trackId);
    if (trackRegions?.has(regionData.id)) {
      throw new AudioEngineError(AudioEngineErrorCode.REGION_ID_CONFLICT, ERROR_MESSAGES.REGION_ID_CONFLICT, {
        trackId,
        regionId: regionData.id,
      });
    }
    trackRegions?.set(regionData.id, this.cloneRegionData(regionData));
    console.log(`[MockAudioEngine] Adding region ${regionData.id} to track ${trackId}`);
  }

  removeRegion(trackId: string, regionId: string): void {
    this.mockRegions.get(trackId)?.delete(regionId);
    console.log(`[MockAudioEngine] Removing region ${regionId} from track ${trackId}`);
  }

  rescheduleRegion(request: RescheduleRegionRequest): void {
    const trackRegions = this.mockRegions.get(request.trackId);
    const regionData = trackRegions?.get(request.regionId);
    if (!trackRegions || !regionData) {
      throw this.createRegionNotFoundError(request);
    }

    trackRegions.set(request.regionId, { ...regionData, startTime: request.startTime });
  }

  async replaceRegion(request: ReplaceRegionRequest): Promise<void> {
    const currentRegions = this.mockRegions.get(request.trackId);
    if (!currentRegions?.has(request.regionId)) {
      throw this.createRegionNotFoundError(request);
    }

    this.validateReplacementIds(currentRegions, request);
    const nextRegions = new Map(currentRegions);
    nextRegions.delete(request.regionId);
    request.replacements.forEach(regionData => {
      nextRegions.set(regionData.id, this.cloneRegionData(regionData));
    });
    this.mockRegions.set(request.trackId, nextRegions);
  }

  async exportProject(request: ExportRequest): Promise<Blob> {
    console.log('[MockAudioEngine] Exporting project', request);
    return new Blob(['mock-audio-data'], { type: 'audio/wav' });
  }

  private initializeTrack(trackId: string): void {
    if (!this.mockTracks.has(trackId)) {
      this.mockTracks.set(trackId, { muted: false, pan: 0, soloed: false, volume: 1 });
    }
    if (!this.mockRegions.has(trackId)) {
      this.mockRegions.set(trackId, new Map());
    }
  }

  private getTrack(trackId: string): MockTrackState {
    const track = this.mockTracks.get(trackId);
    if (!track) {
      throw new AudioEngineError(AudioEngineErrorCode.TRACK_NOT_FOUND, ERROR_MESSAGES.TRACK_NOT_FOUND, { trackId });
    }
    return track;
  }

  private validateReplacementIds(currentRegions: Map<string, RegionData>, request: ReplaceRegionRequest): void {
    const replacementIds = new Set<string>();
    const hasConflict = request.replacements.some(replacement => {
      if (replacementIds.has(replacement.id)) {
        return true;
      }
      replacementIds.add(replacement.id);
      return replacement.id !== request.regionId && currentRegions.has(replacement.id);
    });

    if (hasConflict) {
      throw new AudioEngineError(AudioEngineErrorCode.REGION_ID_CONFLICT, ERROR_MESSAGES.REGION_ID_CONFLICT, {
        trackId: request.trackId,
        regionId: request.regionId,
      });
    }
  }

  private createRegionNotFoundError(request: { trackId: string; regionId: string }): AudioEngineError {
    return new AudioEngineError(AudioEngineErrorCode.REGION_NOT_FOUND, ERROR_MESSAGES.REGION_NOT_FOUND, {
      trackId: request.trackId,
      regionId: request.regionId,
    });
  }

  private cloneRegionData(regionData: RegionData): RegionData {
    return { ...regionData };
  }
}
