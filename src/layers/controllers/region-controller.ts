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
    const regionToSplit = track.regions.find(
        r => splitTime > r.startTime && splitTime < r.endTime
    );
    
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
    
    // 3. Update Audio Engine
    // Engine might need to know about the split, or we just remove old and add new?
    // define splitRegion in IAudioEngine? It exists.
    // If Engine handles split internally, it might generate its own IDs or references.
    // But usually Engine follows Controller's commands.
    // Let's call splitRegion on engine.
    // If engine's splitRegion returns new IDs, we should use them?
    // Or we pass IDs?
    // IAudioEngine.splitRegion(trackId, splitTime) signature doesn't take IDs.
    // This implies Engine handles the logic and maybe returns the new regions?
    // I need to check AudioEngine.splitRegion signature and return type.
    
    await this.audioEngine.splitRegion(trackId, splitTime);
    
    // 4. Update Session Store
    // If Engine handles it, we should ideally sync from Engine or duplicate logic?
    // "Single Source of Truth" is SessionStore (for UI) + Engine (for Audio).
    // If I duplicate logic here, I mitigate dependency on Engine's internal state mechanism.
    // But IDs must match.
    // If Engine generates IDs, I must get them.
    // Re-reading IAudioEngine.splitRegion return type: Promise<void>.
    // It does NOT return new IDs.
    // This suggests AudioEngine might be stateful and we might desync if we generate different IDs here.
    // OR AudioEngine relies on us to reload the track/regions?
    // But addRegion takes ID. splitRegion doesn't.
    // This is a design flaw in IAudioEngine or implies IAudioEngine updates its own state and we assume it works?
    // But UI needs the new IDs to render.
    // If I generate IDs here, Engine doesn't know them unless I use remove/add instead of split.
    // Calling removeRegion + addRegion(left) + addRegion(right) is safer for ID sync.
    // I will implement it as remove + add + add in Controller to ensure ID consistency.
    
    // IMPLEMENTATION CHANGE: Use atomic remove+add+add on Engine instead of splitRegion 
    // IF splitRegion doesn't allow ID control.
    // OR check if AudioEngine.splitRegion allows passing IDs?
    // IAudioEngine interface says `splitRegion(trackId: string, splitTime: number): Promise<void>`.
    // So I cannot pass IDs.
    // So I should replace splitRegion call with remove + add + add.
    
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
