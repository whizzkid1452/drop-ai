import type { IAudioEngine, RegionData } from '../audio-engine/i-audio-engine';
import { type SessionStore } from '../session/session';

export class RegionController {
  constructor(
    private sessionStore: SessionStore,
    private audioEngine: IAudioEngine
  ) {}

  async addRegion(
    trackId: string,
    file: File | string,
    startTime: number
  ): Promise<void> {
    console.log(`[RegionController] Adding region to track: ${trackId}`);

    const regionId = crypto.randomUUID();
    const url = typeof file === 'string' ? file : URL.createObjectURL(file);

    const regionData: RegionData = {
      id: regionId,
      url,
      startTime,
      sourceStartTime: 0,
    };

    await this.audioEngine.addRegion(trackId, regionData);
  }

  removeRegion(trackId: string, regionId: string): void {
    console.log(`[RegionController] Removing region ${regionId} from track ${trackId}`);

    this.audioEngine.removeRegion(trackId, regionId);
  }

  async splitRegion(trackId: string, splitTime: number): Promise<void> {
    console.log(`[RegionController] Splitting region at ${splitTime} on track ${trackId}`);

    await this.audioEngine.splitRegion(trackId, splitTime);
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
