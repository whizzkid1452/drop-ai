import { useTrackStore } from '@/stores/useTrackStore';
import { calculateSplitRegion } from '../logic/regionLogic';
import { useCallback } from 'react';
import { AudioEngine } from '@/logics/audio/audioEngine';

export const useTrackActions = () => {
    const updateTrack = useTrackStore(state => state.updateTrack);
    const getTrack = useTrackStore(state => state.getTrack);

    /**
     * Split a region at the specified time
     * @param trackId - The ID of the track containing the region
     * @param splitTime - The timeline position (in seconds) to split at
     */
    const splitRegion = useCallback(
        (trackId: string, splitTime: number) => {
            const track = getTrack({ trackId });
            if (!track) {
                console.warn(`Track not found: ${trackId}`);
                return;
            }

            // Find the region that contains the splitTime
            // Note: We avoid splitting exactly at the start edge to prevent empty regions
            // but splitting at end edge is handled by logic returning null
            const region = track.regions.find(
                r => r.startTime <= splitTime && r.endTime > splitTime
            );

            if (!region) {
                console.warn(`No region found at time ${splitTime} in track ${trackId}`);
                return;
            }

            // 1. Calculate the new regions (Pure Logic)
            const result = calculateSplitRegion(region, splitTime);

            if (!result) {
                console.warn('Split calculation failed (invalid time?)');
                return;
            }

            // 2. Update the Store (State Mutation)
            updateTrack({
                trackId,
                updater: t => {
                    // Remove the original region and add the two new ones
                    const otherRegions = t.regions.filter(r => r.id !== region.id);
                    const newRegions = [...otherRegions, result.left, result.right];

                    // Sort by start time for safety (though not strictly required if other logic handles it)
                    newRegions.sort((a, b) => a.startTime - b.startTime);

                    return {
                        ...t,
                        regions: newRegions,
                    };
                },
            });

            // 3. Sync with AudioEngine
            const engine = AudioEngine.getInstance();

            // a) Unload the original region
            engine.execute({
                command: {
                    type: 'UNLOAD_REGION',
                    trackId,
                    regionId: region.id,
                },
            });

            // b) Load the new regions
            [result.left, result.right].forEach(newRegion => {
                engine.execute({
                    command: {
                        type: 'LOAD_REGION',
                        trackId,
                        regionId: newRegion.id,
                        url: newRegion.audioFile.url,
                        startTime: newRegion.startTime,
                        startOffset: newRegion.sourceStart,
                    },
                });
            });
        },
        [getTrack, updateTrack]
    );

    return {
        splitRegion,
    };
};
