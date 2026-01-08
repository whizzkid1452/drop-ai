import { AudioEngine } from '@/logics/audio/audioEngine';
import type { AudioCommand } from '@/types/audioCommand.schema';

/**
 * AudioEngine Abstraction Hook
 * - Provides access to the audio engine instance
 * - Allows for dependency injection/mocking in tests structure
 */
export interface IAudioEngine {
    execute(params: {
        command: AudioCommand;
        callback?: (params: { command: AudioCommand; result: any }) => void;
    }): Promise<any>;
}

export const useAudioEngine = (): IAudioEngine => {
    // Currently returns the Singleton, but can be swapped for Context later
    return AudioEngine.getInstance();
};
