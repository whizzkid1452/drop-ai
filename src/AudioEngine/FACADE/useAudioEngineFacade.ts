import { useStore } from 'zustand';
import { useMemo } from 'react';
import { AudioService } from '@/AudioEngine/FACADE/audioEngineFacade';
import type { AudioSnapshot } from '@/types/audioTypes';

/**
 * useAudioService Hook (ViewModel Adapter)
 * 
 * Connects React Components to the AudioService Store.
 * Supports Selectors for performance optimization (avoids re-renders).
 * 
 * ✅ 모든 React 컴포넌트는 이 hook을 통해서만 AudioService 상태에 접근해야 합니다.
 */
export function useAudioService(): AudioSnapshot;
export function useAudioService<T>(selector: (state: AudioSnapshot) => T): T;
export function useAudioService<T>(selector?: (state: AudioSnapshot) => T) {
    const store = AudioService.getInstance().store;
    return useStore(store, selector!);
}

/**
 * useAudioServiceActions Hook
 * 
 * Provides access to AudioService methods for React components.
 * 
 * ✅ 모든 React 컴포넌트는 이 hook을 통해서만 AudioService 메서드를 호출해야 합니다.
 */
export function useAudioServiceActions() {
    return useMemo(() => {
        const service = AudioService.getInstance();
        return {
            // Transport
            play: () => service.play(),
            pause: () => service.pause(),
            stop: () => service.stop(),
            setTime: (time: number) => service.setTime(time),
            getCurrentTime: () => service.getCurrentTime(),
            
            // Track Management
            setTrackVolume: (trackId: string, volume: number) => service.setTrackVolume(trackId, volume),
            setTrackPan: (trackId: string, pan: number) => service.setTrackPan(trackId, pan),
            removeTrack: (trackId: string) => service.removeTrack(trackId),
            
            // Region Management
            addRegion: (trackId: string, regionData: Parameters<typeof service.addRegion>[1]) => 
                service.addRegion(trackId, regionData),
            removeRegion: (trackId: string, regionId: string) => service.removeRegion(trackId, regionId),
            splitRegion: (trackId: string, splitTime: number) => service.splitRegion(trackId, splitTime),
            
            // Export
            exportProject: (options?: Parameters<typeof service.exportProject>[0]) => 
                service.exportProject(options),
            setExportRange: (startTime: number | null, endTime: number | null) => 
                service.setExportRange(startTime, endTime),
            
            // Configuration
            setTempo: (tempo: number) => service.setTempo(tempo),
            setPixelsPerSecond: (pixelsPerSecond: number) => service.setPixelsPerSecond(pixelsPerSecond),
            
            // Live Performance
            playNote: (note: string | number, velocity?: number) => service.playNote(note, velocity),
            stopNote: (note: string | number) => service.stopNote(note),
        };
    }, []);
}
