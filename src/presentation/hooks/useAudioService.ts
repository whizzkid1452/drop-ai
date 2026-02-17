import { useStore } from 'zustand';
import { AudioService } from '@/core/audio/AudioService';
import type { AudioSnapshot } from '@/types/audioTypes';

/**
 * useAudio Hook (ViewModel Adapter)
 *
 * Connects React Components to the AudioService Store.
 * Supports Selectors for performance optimization (avoids re-renders).
 */
export function useAudioService(): AudioSnapshot;
export function useAudioService<T>(selector: (state: AudioSnapshot) => T): T;
export function useAudioService<T>(selector?: (state: AudioSnapshot) => T) {
  const store = AudioService.getInstance().store;
  return useStore(store, selector!);
}
