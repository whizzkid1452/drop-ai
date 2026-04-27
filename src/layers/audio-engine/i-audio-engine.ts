import type { RegionState } from '../session/session';

export interface IAudioEngine {
  play(): Promise<void>;
  stop(): void;
  pause(): void;
  setVolume(value: number): void;
  seekTo(time: number): void;
  getCurrentTime(): number;
  loadFile(file: File): Promise<{ src: string; duration: number }>;
  createTrack(id: string): void;
  addRegion(trackId: string, region: RegionState): void;
  removeRegion(trackId: string, regionId: string): void;
  moveRegion(trackId: string, regionId: string, newStartTime: number): void;
  setTrackVolume(id: string, volume: number): void;
  setTrackMute(id: string, muted: boolean): void;
  setTrackSolo(id: string, soloed: boolean): void;
  setTrackPan(id: string, pan: number): void;
  removeTrack(id: string): void;
  setLoop(loop: boolean): void;
  setLoopPoints(start: number, end: number): void;
  setBpm(bpm: number): void;
  getDebugInfo(): string;
  exportSession(
    duration: number,
    tracks: Map<
      string,
      {
        volume: number;
        isMuted: boolean;
        isSoloed: boolean;
        pan: number;
        regions: RegionState[];
      }
    >
  ): Promise<Blob>;
}
