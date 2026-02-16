import type { IAudioEngine } from './i-audio-engine';

/**
 * Mock Audio Engine for testing and CLI environments.
 * Does not produce actual sound but simulates the behavior.
 */
export class MockAudioEngine implements IAudioEngine {
    async play(): Promise<void> {
        console.log('[MockAudioEngine] Playing...');
    }

    stop(): void {
        console.log('[MockAudioEngine] Stopped.');
    }

    pause(): void {
        console.log('[MockAudioEngine] Paused.');
    }

    setVolume(value: number): void {
        console.log(`[MockAudioEngine] Volume set to: ${value}`);
    }

    seekTo(time: number): void {
        console.log(`[MockAudioEngine] Seeked to: ${time}`);
    }

    async loadTrack(url: string, id: string): Promise<void> {
        console.log(`[MockAudioEngine] Track ${id} loaded from ${url}`);
    }
}
