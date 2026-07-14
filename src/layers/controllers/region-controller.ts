import type { IAudioEngine, RegionData } from '../audio-engine/i-audio-engine';
import { type SessionStore } from '../session/session';

export class RegionController {
  constructor(
    private sessionStore: SessionStore,
    private audioEngine: IAudioEngine
  ) {}

  async addRegion(trackId: string, regionData: RegionData): Promise<void> {
    console.log(`[RegionController] Adding region to track: ${trackId}`, regionData);

    // 1. Audio Engine Update
    await this.audioEngine.addRegion(trackId, regionData);

    // 2. Session Store Update
    const track = this.sessionStore.getState().tracks.get(trackId);
    if (!track) {
      console.warn(`[RegionController] Track ${trackId} not found in session`);
      return;
    }

    const newRegion = {
      id: regionData.id,
      startTime: regionData.startTime,
      endTime: regionData.startTime + (regionData.duration || 0),
      sourceStartTime: regionData.sourceStartTime || 0,
      duration: regionData.duration || 0,
      status: [],
      audioFileUrl: regionData.url,
    };

    const updatedRegions = [...track.regions, newRegion];
    this.sessionStore.getState().updateTrack(trackId, { regions: updatedRegions });
  }

  removeRegion(trackId: string, regionId: string): void {
    console.log(`[RegionController] Removing region ${regionId} from track ${trackId}`);

    this.audioEngine.removeRegion(trackId, regionId);

    const track = this.sessionStore.getState().tracks.get(trackId);
    if (!track) return;

    this.sessionStore.getState().updateTrack(trackId, {
      regions: track.regions.filter(region => region.id !== regionId),
    });
  }

  async splitRegion(trackId: string, splitTime: number): Promise<void> {
    console.log(`[RegionController] Splitting region at ${splitTime} on track ${trackId}`);

    // 1. Get current region from session
    const track = this.sessionStore.getState().tracks.get(trackId);
    if (!track) {
      console.warn(`[RegionController] Track ${trackId} not found`);
      return;
    }

    // Find the region containing the split time
    const regionToSplit = track.regions.find(r => splitTime > r.startTime && splitTime < r.endTime);

    if (!regionToSplit) {
      console.warn(`[RegionController] No valid region found to split at ${splitTime}`);
      return;
    }

    // 2. Calculate split logic (Logic moved from Region.ts)
    const offsetFromStart = splitTime - regionToSplit.startTime;

    const leftRegion = {
      ...regionToSplit,
      id: crypto.randomUUID(),
      duration: offsetFromStart,
      endTime: regionToSplit.startTime + offsetFromStart,
      status: [...regionToSplit.status], // shallow copy status
      // sourceStartTime keeps same
    };

    const rightRegion = {
      ...regionToSplit,
      id: crypto.randomUUID(),
      startTime: splitTime,
      sourceStartTime: regionToSplit.sourceStartTime + offsetFromStart,
      duration: regionToSplit.duration - offsetFromStart,
      endTime: splitTime + (regionToSplit.duration - offsetFromStart),
      status: [...regionToSplit.status],
    };

    // Controller가 만든 ID를 Engine에도 전달해 Session 상태와 오디오 리소스 키를 일치시킨다.
    await this.audioEngine.removeRegion(trackId, regionToSplit.id);
    await this.audioEngine.addRegion(trackId, { ...leftRegion, url: leftRegion.audioFileUrl || '' });
    await this.audioEngine.addRegion(trackId, { ...rightRegion, url: rightRegion.audioFileUrl || '' });

    // Update Store
    const newRegions = track.regions.filter(r => r.id !== regionToSplit.id);
    newRegions.push(leftRegion, rightRegion);

    this.sessionStore.getState().updateTrack(trackId, { regions: newRegions });
  }

  moveRegion(trackId: string, regionId: string, newStartTime: number): void {
    console.log(`[RegionController] Moving region ${regionId} to ${newStartTime}`);

    // 현재는 region 이동을 직접 구현하지 않고, SessionStore 업데이트
    const track = this.sessionStore.getState().tracks.get(trackId);
    if (!track) return;

    const updatedRegions = track.regions.map(region => {
      if (region.id === regionId) {
        return { ...region, startTime: newStartTime };
      }
      return region;
    });

    this.sessionStore.getState().updateTrack(trackId, { regions: updatedRegions });
  }
}
