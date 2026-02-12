export interface RegionData {
  id: string;
  url: string;
  startTime: number;
  sourceStartTime: number;
  duration?: number;
  audioFile?: { url: string; duration?: number };
  status?: string[];
}

export interface ExportOptions {
  tracks?: any[];
  range?: {
    startTime: number;
    endTime: number;
  };
}

export interface IAudioEngine {
  // Transport Control
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  setTime(time: number): void;
  getCurrentTime(): number;

  // Tempo
  setTempo(tempo: number): void;

  // Track Management
  loadTrack(url: string, id: string): Promise<void>;
  setTrackVolume(trackId: string, volume: number): void;
  setTrackPan(trackId: string, pan: number): void;
  getTrackParams(trackId: string): { volume: number; pan: number } | null;

  // Region Management
  addRegion(trackId: string, regionData: RegionData): Promise<void>;
  removeRegion(trackId: string, regionId: string): void;
  splitRegion(trackId: string, splitTime: number): Promise<void>;
  moveRegion(trackId: string, regionId: string, newStartTime: number, sourceStartTime: number): void;

  // Export
  setExportRange(startTime: number | null, endTime: number | null): void;
  exportProject(options?: ExportOptions): Promise<Blob>;

  // Legacy (keep for compatibility)
  setVolume(value: number): void;
  seekTo(time: number): void;
}
