import { useSyncExternalStore } from 'react';
import { AudioService } from '@/core/audio/AudioService';

/**
 * useAudio Hook (ViewModel Adapter)
 * 
 * Connects React Components to the imperative AudioService.
 * Uses useSyncExternalStore to subscribe to changes in the AudioService
 * and trigger re-renders only when necessary.
 * 
 * @returns Immutable snapshot of the audio engine state.
 */
export const useAudio = () => {
    const service = AudioService.getInstance();

    console.log('[useAudio] Subscribing to AudioService');

    const state = useSyncExternalStore(
        (callback) => {
            console.log('[useAudio] Setting up subscription');
            return service.subscribe(callback);
        },
        () => {
            const snapshot = service.getSnapshot();
            console.log('[useAudio] Getting snapshot', snapshot);
            return snapshot;
        }
    );

    console.log('[useAudio] Returning state', state);
    return state;
};
