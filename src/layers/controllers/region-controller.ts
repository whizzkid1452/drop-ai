import type { IAudioEngine, RegionData } from '../audio-engine/i-audio-engine';
import type { RegionState, SessionStore, TrackState } from '../session/session';
import { ProjectStateError, ProjectStateErrorCode } from './project-state-error';
import { calculateSplitRegions } from './utils/split-region';

interface SplitRegionByIdOptions {
  trackId: string;
  regionId: string;
  splitTime: number;
}

interface MoveRegionOptions {
  trackId: string;
  regionId: string;
  newStartTime: number;
}

export class RegionController {
  constructor(
    private sessionStore: SessionStore,
    private audioEngine: IAudioEngine
  ) {}

  async addRegion(trackId: string, regionData: RegionData): Promise<void> {
    console.log(`[RegionController] Adding region to track: ${trackId}`, regionData);

    const track = this.getTrackOrThrow(trackId);
    this.throwIfRegionExists(track, regionData.id);
    await this.audioEngine.addRegion(trackId, regionData);

    const latestTrack = this.getTrackOrThrow(trackId);
    this.throwIfRegionExists(latestTrack, regionData.id);

    const newRegion = {
      id: regionData.id,
      startTime: regionData.startTime,
      endTime: regionData.startTime + (regionData.duration || 0),
      sourceStartTime: regionData.sourceStartTime || 0,
      duration: regionData.duration || 0,
      status: [],
      audioFileUrl: regionData.url,
    };

    const updatedRegions = [...latestTrack.regions, newRegion];
    this.sessionStore.getState().updateTrack(trackId, { regions: updatedRegions });
  }

  removeRegion(trackId: string, regionId: string): void {
    console.log(`[RegionController] Removing region ${regionId} from track ${trackId}`);

    const track = this.getTrackOrThrow(trackId);
    this.getRegionOrThrow(track, regionId);
    this.audioEngine.removeRegion(trackId, regionId);
    this.sessionStore.getState().updateTrack(trackId, {
      regions: track.regions.filter(region => region.id !== regionId),
    });
  }

  async splitRegion(trackId: string, splitTime: number): Promise<void> {
    console.log(`[RegionController] Splitting region at ${splitTime} on track ${trackId}`);

    const track = this.getTrackOrThrow(trackId);
    const [regionToSplit, ...additionalRegions] = track.regions.filter(
      region => splitTime > region.startTime && splitTime < region.endTime
    );
    if (!regionToSplit) {
      throw new ProjectStateError(
        ProjectStateErrorCode.INVALID_SPLIT_POSITION,
        `분할할 수 없는 위치입니다: ${splitTime}`,
        { trackId, splitTime }
      );
    }
    if (additionalRegions.length > 0) {
      throw new ProjectStateError(
        ProjectStateErrorCode.AMBIGUOUS_REGION_TARGET,
        '겹친 Region은 Region ID를 지정해서 분할해야 합니다.',
        {
          trackId,
          splitTime,
          regionIds: [regionToSplit, ...additionalRegions].map(region => region.id),
        }
      );
    }

    await this.splitRegionById({ trackId, regionId: regionToSplit.id, splitTime });
  }

  async splitRegionById({ trackId, regionId, splitTime }: SplitRegionByIdOptions): Promise<void> {
    const track = this.getTrackOrThrow(trackId);
    const regionToSplit = this.getRegionOrThrow(track, regionId);

    if (splitTime <= regionToSplit.startTime || splitTime >= regionToSplit.endTime) {
      throw new ProjectStateError(
        ProjectStateErrorCode.INVALID_SPLIT_POSITION,
        `Region 내부에서만 분할할 수 있습니다: ${splitTime}`,
        { trackId, regionId, splitTime }
      );
    }

    const sourceUrl = regionToSplit.audioFileUrl;
    if (!sourceUrl) {
      throw new ProjectStateError(
        ProjectStateErrorCode.REGION_SOURCE_MISSING,
        `Region의 오디오 소스를 찾을 수 없습니다: ${regionId}`,
        { trackId, regionId }
      );
    }

    const splitRegions = calculateSplitRegions({ region: regionToSplit, splitTime });
    if (!splitRegions) {
      throw new ProjectStateError(
        ProjectStateErrorCode.INVALID_SPLIT_POSITION,
        `Region 내부에서만 분할할 수 있습니다: ${splitTime}`,
        { trackId, regionId, splitTime }
      );
    }

    const { left: leftRegion, right: rightRegion } = splitRegions;

    await this.audioEngine.replaceRegion({
      trackId,
      regionId,
      replacements: [this.toRegionData(leftRegion, sourceUrl), this.toRegionData(rightRegion, sourceUrl)],
    });

    const latestTrack = this.getTrackOrThrow(trackId);
    this.getRegionOrThrow(latestTrack, regionId);
    const regions = latestTrack.regions.flatMap(region =>
      region.id === regionId ? [leftRegion, rightRegion] : [region]
    );
    this.sessionStore.getState().updateTrack(trackId, { regions });
  }

  moveRegion({ trackId, regionId, newStartTime }: MoveRegionOptions): void {
    console.log(`[RegionController] Moving region ${regionId} to ${newStartTime}`);

    const track = this.getTrackOrThrow(trackId);
    this.getRegionOrThrow(track, regionId);
    if (newStartTime < 0) {
      throw new ProjectStateError(
        ProjectStateErrorCode.INVALID_REGION_POSITION,
        `Region 시작 위치는 0 이상이어야 합니다: ${newStartTime}`,
        { trackId, regionId, newStartTime }
      );
    }
    this.audioEngine.rescheduleRegion({ trackId, regionId, startTime: newStartTime });

    const regions = track.regions.map(region =>
      region.id === regionId ? { ...region, startTime: newStartTime, endTime: newStartTime + region.duration } : region
    );
    this.sessionStore.getState().updateTrack(trackId, { regions });
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

  private getRegionOrThrow(track: TrackState, regionId: string): RegionState {
    const region = track.regions.find(candidate => candidate.id === regionId);
    if (region) {
      return region;
    }

    throw new ProjectStateError(ProjectStateErrorCode.REGION_NOT_FOUND, `Region을 찾을 수 없습니다: ${regionId}`, {
      trackId: track.id,
      regionId,
    });
  }

  private throwIfRegionExists(track: TrackState, regionId: string): void {
    if (!track.regions.some(region => region.id === regionId)) {
      return;
    }

    throw new ProjectStateError(
      ProjectStateErrorCode.REGION_ID_CONFLICT,
      `이미 사용 중인 Region ID입니다: ${regionId}`,
      { trackId: track.id, regionId }
    );
  }

  private toRegionData(region: RegionState, url: string): RegionData {
    return {
      id: region.id,
      url,
      startTime: region.startTime,
      sourceStartTime: region.sourceStartTime,
      duration: region.duration,
    };
  }
}
