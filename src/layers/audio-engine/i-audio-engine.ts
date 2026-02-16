export interface IAudioEngine {
  play(): Promise<void>;
  stop(): void;
  pause(): void;
  setVolume(value: number): void;
  seekTo(time: number): void;
  loadFile(file: File): Promise<{ src: string }>;
}
