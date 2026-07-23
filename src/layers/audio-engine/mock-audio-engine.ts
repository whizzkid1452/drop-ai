import { AudioEngineError, AudioEngineErrorCode, ERROR_MESSAGES } from './errors';
import { COMPLETE_RESOURCE_CLEANUP } from '../shared/types/resource-cleanup';
import type {
  ExportRequest,
  IAudioEngine,
  IPreparedAudioProjectGraph,
  IRetiredAudioProjectGraph,
  PrepareAudioProjectGraphRequest,
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
  private graphRevision = 0;

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
    this.graphRevision += 1;
    console.log(`[MockAudioEngine] Track added: ${trackId}`);
  }

  removeTrack(trackId: string): void {
    this.mockTracks.delete(trackId);
    this.mockRegions.delete(trackId);
    this.graphRevision += 1;
    console.log(`[MockAudioEngine] Track ${trackId} removed`);
  }

  setTrackVolume(trackId: string, volume: number): void {
    this.initializeTrack(trackId);
    const track = this.mockTracks.get(trackId);
    if (track) {
      track.volume = volume;
    }
    this.graphRevision += 1;
    console.log(`[MockAudioEngine] Track ${trackId} volume set to: ${volume}`);
  }

  setTrackPan(trackId: string, pan: number): void {
    this.initializeTrack(trackId);
    const track = this.mockTracks.get(trackId);
    if (track) {
      track.pan = pan;
    }
    this.graphRevision += 1;
    console.log(`[MockAudioEngine] Track ${trackId} pan set to: ${pan}`);
  }

  setTrackMute(trackId: string, muted: boolean): void {
    this.getTrack(trackId).muted = muted;
    this.graphRevision += 1;
  }

  setTrackSolo(trackId: string, soloed: boolean): void {
    this.getTrack(trackId).soloed = soloed;
    this.graphRevision += 1;
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
    this.graphRevision += 1;
    console.log(`[MockAudioEngine] Adding region ${regionData.id} to track ${trackId}`);
  }

  removeRegion(trackId: string, regionId: string): void {
    this.mockRegions.get(trackId)?.delete(regionId);
    this.graphRevision += 1;
    console.log(`[MockAudioEngine] Removing region ${regionId} from track ${trackId}`);
  }

  rescheduleRegion(request: RescheduleRegionRequest): void {
    const trackRegions = this.mockRegions.get(request.trackId);
    const regionData = trackRegions?.get(request.regionId);
    if (!trackRegions || !regionData) {
      throw this.createRegionNotFoundError(request);
    }

    trackRegions.set(request.regionId, { ...regionData, startTime: request.startTime });
    this.graphRevision += 1;
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
    this.graphRevision += 1;
  }

  async prepareProjectGraph({ tracks }: PrepareAudioProjectGraphRequest): Promise<IPreparedAudioProjectGraph> {
    const expectedRevision = this.graphRevision;
    const nextTracks = new Map<string, MockTrackState>();
    const nextRegions = new Map<string, Map<string, RegionData>>();

    tracks.forEach(track => {
      if (nextTracks.has(track.id)) {
        throw new AudioEngineError(AudioEngineErrorCode.TRACK_INIT_FAILED, ERROR_MESSAGES.TRACK_INIT_FAILED, {
          trackId: track.id,
        });
      }

      const trackRegions = new Map<string, RegionData>();
      track.regions.forEach(region => {
        if (trackRegions.has(region.id)) {
          throw new AudioEngineError(AudioEngineErrorCode.REGION_ID_CONFLICT, ERROR_MESSAGES.REGION_ID_CONFLICT, {
            regionId: region.id,
            trackId: track.id,
          });
        }
        trackRegions.set(region.id, this.cloneRegionData(region));
      });
      nextTracks.set(track.id, {
        muted: track.isMuted,
        pan: track.pan,
        soloed: track.isSoloed,
        volume: track.volume,
      });
      nextRegions.set(track.id, trackRegions);
    });

    let retiredGraph: IRetiredAudioProjectGraph | undefined;
    let state: 'activated' | 'discarded' | 'prepared' = 'prepared';
    const assertActivatable = (): void => {
      if (state === 'activated') {
        return;
      }
      if (state === 'discarded' || this.graphRevision !== expectedRevision) {
        throw new AudioEngineError(AudioEngineErrorCode.ACTIVE_GRAPH_CHANGED, ERROR_MESSAGES.ACTIVE_GRAPH_CHANGED, {
          actualRevision: this.graphRevision,
          expectedRevision,
        });
      }
    };

    return {
      assertActivatable,
      activate: () => {
        if (retiredGraph) {
          return retiredGraph;
        }

        assertActivatable();
        this.mockTracks = nextTracks;
        this.mockRegions = nextRegions;
        this.mockTime = 0;
        this.graphRevision += 1;
        state = 'activated';
        retiredGraph = { dispose: () => COMPLETE_RESOURCE_CLEANUP };
        return retiredGraph;
      },
      discard: () => {
        if (state === 'activated') {
          return COMPLETE_RESOURCE_CLEANUP;
        }
        state = 'discarded';
        return COMPLETE_RESOURCE_CLEANUP;
      },
    };
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
