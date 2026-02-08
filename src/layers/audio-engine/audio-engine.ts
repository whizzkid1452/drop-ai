import type { IAudioEngine } from './i-audio-engine';

export class AudioEngine implements IAudioEngine {
    async play(): Promise<void> {
        // Implement actual audio play logic here (e.g. Tone.js)
        // For now, it's a placeholder implementation
        console.log('[AudioEngine] Play');
    }

    stop(): void {
        console.log('[AudioEngine] Stop');
    }

    pause(): void {
        console.log('[AudioEngine] Pause');
    }
}
