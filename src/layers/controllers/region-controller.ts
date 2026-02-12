import { type IAudioEngine, type RegionData } from '@/layers/audio-engine';
import { type SessionStore } from '@/layers/session';

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

    // 1. Update AudioEngine
    this.audioEngine.removeRegion(trackId, regionId);
    
    // 2. Update SessionStore
    const track = this.sessionStore.getState().tracks.get(trackId);
    if (track) {
      const newRegions = track.regions.filter(r => r.id !== regionId);
      this.sessionStore.getState().updateTrack(trackId, { regions: newRegions });
    }
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
    // We use atomic remove + add + add to ensure IDs match between Controller/Store and AudioEngine
    // IAudioEngine.splitRegion generates internal IDs we can't control, so we avoid it.
    await this.audioEngine.removeRegion(trackId, regionToSplit.id);
    await this.audioEngine.addRegion(trackId, { ...leftRegion, url: leftRegion.audioFileUrl || '' });
    await this.audioEngine.addRegion(trackId, { ...rightRegion, url: rightRegion.audioFileUrl || '' });
    
    // 4. Update Session Store
    // AudioEngine.addRegion/removeRegion already updates the store, so we might not need to do it here.
    // However, to ensure we have the exact object shape and status we want (e.g. valid UUIDs),
    // we updated the Store in AudioEngine.addRegion using the data we passed.
    // So if we pass correct IDs to AudioEngine, the Store will be updated correctly by AudioEngine.
    // BUT AudioEngine only pushes to array. It doesn't replace.
    // So removeRegion called above should have removed the old one from Store.
    // And addRegion called above should have added the new ones.
    // So we don't need to manually update store here if AudioEngine does it.
    // Let's rely on AudioEngine to update the store to avoid race conditions or duplicates.
    // Verification:
    // removeRegion -> updates store (filters out)
    // addRegion -> updates store (pushes)
    // So the Store state should be correct.
  }

  moveRegion(params: { trackId: string; regionId: string; newStartTime: number }): void {
    const { trackId, regionId, newStartTime } = params;
    console.log(`[RegionController] Moving region ${regionId} to ${newStartTime}`);
    
    // 0. Get current region to find sourceStartTime
    const track = this.sessionStore.getState().tracks.get(trackId);
    if (!track) {
      console.warn(`[RegionController] Track ${trackId} not found`);
      return;
    }
    const region = track.regions.find(r => r.id === regionId);
    if (!region) {
      console.warn(`[RegionController] Region ${regionId} not found in store`);
      // Critical error: UI called move on non-existent region?
      return;
    }

    // 1. Update AudioEngine (Pass sourceStartTime explicitly)
    this.audioEngine.moveRegion({
      trackId, 
      regionId, 
      newStartTime, 
      sourceStartTime: region.sourceStartTime
    });
    
    // 2. Update SessionStore
    const updatedRegions = track.regions.map(r => {
      if (r.id === regionId) {
        return { ...r, startTime: newStartTime, endTime: newStartTime + r.duration };
      }
      return r;
    });

    this.sessionStore.getState().updateTrack(trackId, { regions: updatedRegions });
  }
}
