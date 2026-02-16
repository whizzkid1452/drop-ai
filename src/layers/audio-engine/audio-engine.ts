import type { IAudioEngine } from './i-audio-engine';

export class AudioEngine implements IAudioEngine {
  async play(): Promise<void> {
    console.log('[AudioEngine] Play');
  }

  stop(): void {
    console.log('[AudioEngine] Stop');
  }

  pause(): void {
    console.log('[AudioEngine] Pause');
  }

  setVolume(value: number): void {
    console.log(`[AudioEngine] Set Volume: ${value}`);
  }

  seekTo(time: number): void {
    console.log(`[AudioEngine] Seek to: ${time}`);
  }

  async loadFile(file: File): Promise<{ src: string }> {
    const src = URL.createObjectURL(file);
    console.log(`[AudioEngine] Loading track from ${src}`);
    return { src };
  }
}
