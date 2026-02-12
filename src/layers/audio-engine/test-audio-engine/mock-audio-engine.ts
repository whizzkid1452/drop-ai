import type { IAudioEngine, RegionData, ExportOptions } from '../i-audio-engine';

/**
 * Mock Audio Engine for testing and CLI environments.
 * Does not produce actual sound but simulates the behavior.
 */
export class MockAudioEngine implements IAudioEngine {
  private mockTime = 0;
  private mockRegions: Map<string, Map<string, any>> = new Map();

  // Transport Control
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

  setTempo(tempo: number): void {
    console.log(`[MockAudioEngine] Tempo set to: ${tempo}`);
  }

  // Track Management
  async loadTrack(url: string, id: string): Promise<void> {
    console.log(`[MockAudioEngine] Track ${id} loaded from ${url}`);
  }

  setTrackVolume(trackId: string, volume: number): void {
    console.log(`[MockAudioEngine] Track ${trackId} volume set to: ${volume}`);
  }

  setTrackPan(trackId: string, pan: number): void {
    console.log(`[MockAudioEngine] Track ${trackId} pan set to: ${pan}`);
  }

  getTrackParams(trackId: string): { volume: number; pan: number } | null {
    console.log(`[MockAudioEngine] Getting params for track: ${trackId}`);
    return { volume: 1.0, pan: 0 };
  }

  // Region Management
  async addRegion(trackId: string, regionData: RegionData): Promise<void> {
    console.log(`[MockAudioEngine] Adding region ${regionData.id} to track ${trackId}`);
    if (!this.mockRegions.has(trackId)) {
      this.mockRegions.set(trackId, new Map());
    }
    this.mockRegions.get(trackId)!.set(regionData.id, regionData);
  }

  removeRegion(trackId: string, regionId: string): void {
    console.log(`[MockAudioEngine] Removing region ${regionId} from track ${trackId}`);
    this.mockRegions.get(trackId)?.delete(regionId);
  }

  async splitRegion(trackId: string, splitTime: number): Promise<void> {
    console.log(`[MockAudioEngine] Splitting region at ${splitTime} on track ${trackId}`);
  }

  moveRegion(params: { trackId: string; regionId: string; newStartTime: number; sourceStartTime: number }): void {
    console.log(`[MockAudioEngine] Moving region ${params.regionId} on track ${params.trackId} to ${params.newStartTime}`);
  }

  // Export
  setExportRange(startTime: number | null, endTime: number | null): void {
    console.log(`[MockAudioEngine] Export range set: ${startTime} - ${endTime}`);
  }

  async exportProject(options?: ExportOptions): Promise<Blob> {
    console.log(`[MockAudioEngine] Exporting project`, options);
    // Return empty WAV blob for testing
    return new Blob(['mock-audio-data'], { type: 'audio/wav' });
  }

  // Legacy (Compatibility)
  setVolume(value: number): void {
    console.log(`[MockAudioEngine] Master volume set to: ${value}`);
  }

  seekTo(time: number): void {
    this.setTime(time);
  }
}
