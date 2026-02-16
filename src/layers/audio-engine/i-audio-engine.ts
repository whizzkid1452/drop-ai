export interface IAudioEngine {
  play(): Promise<void>;
  stop(): void;
  pause(): void;
  setVolume(value: number): void;
  seekTo(time: number): void;
  loadFile(file: File): Promise<{ src: string }>;
  createTrack(id: string): void;
  setTrackSource(id: string, src: string): Promise<void>;
  setTrackVolume(id: string, volume: number): void;
  setTrackMute(id: string, muted: boolean): void;
  setTrackSolo(id: string, soloed: boolean): void;
  removeTrack(id: string): void;
}
