export interface RegionData {
  id: string;
  url: string;
  startTime: number;
  sourceStartTime: number;
  duration?: number;
  audioFile?: { url: string; duration?: number };
}

export const DEFAULT_EXPORT_SAMPLE_RATE = 44100;

export interface ExportRange {
  startTime: number;
  endTime: number;
}

export interface ExportRegion {
  id: string;
  url: string;
  startTime: number;
  sourceStartTime: number;
  duration: number;
}

export interface ExportTrack {
  id: string;
  volume: number;
  pan: number;
  isMuted: boolean;
  isSoloed: boolean;
  regions: ExportRegion[];
}

export interface ExportRequest {
  tracks: ExportTrack[];
  masterVolume: number;
  range: ExportRange;
  sampleRate: number;
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
  removeTrack(trackId: string): void;
  setTrackVolume(trackId: string, volume: number): void;
  setTrackPan(trackId: string, pan: number): void;
  getTrackParams(trackId: string): { volume: number; pan: number } | null;

  // Region Management
  addRegion(trackId: string, regionData: RegionData): Promise<void>;
  removeRegion(trackId: string, regionId: string): void;

  // Export
  exportProject(request: ExportRequest): Promise<Blob>;
}
