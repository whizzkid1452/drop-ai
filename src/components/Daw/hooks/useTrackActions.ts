import { AudioEngine } from '@/logics/audio/audioEngine';
import { useTrackStore } from '@/stores/useTrackStore';
import { calculateSplitRegion } from '../logic/regionLogic';
import { AudioCommandType } from '@/types/audioCommand.schema';
import { useCallback } from 'react';

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
                console.warn(`[Split] Failed: splitTime ${splitTime} is outside region range [${region.startTime}, ${region.endTime}]`);
                return;
            }
            
            console.log(`[Split] Splitting region ${region.id} at ${splitTime}s (range: ${region.startTime}~${region.endTime})`);

            // Destructure for better readability per review
            const { left: leftRegion, right: rightRegion } = result;

            // 2. Update the Store (State Mutation)
            updateTrack({
                trackId,
                updater: t => {
                    // Remove the original region and add the two new ones
                    const otherRegions = t.regions.filter(r => r.id !== region.id);
                    const newRegions = [...otherRegions, leftRegion, rightRegion];

                    // Sort by start time for safety (though not strictly required if other logic handles it)
                    newRegions.sort((a, b) => a.startTime - b.startTime);

                    return {
                        ...t,
                        regions: newRegions,
                    };
                },
            });

        // 3. Sync with AudioEngine
        // IMPORTANT: Must await to prevent race conditions and audio overlap
        (async () => {
            try {
                console.log(`[Split] Starting AudioEngine sync for track ${trackId}`);
                
                const engine = AudioEngine.getInstance();
                
                // a) Unload the original region FIRST
                await engine.execute({
                    type: AudioCommandType.UNLOAD_REGION,
                    trackId,
                    regionId: region.id,
                });

                // b) Load the new regions AFTER unload completes
                // CRITICAL: Calculate duration to prevent overlapping playback
                const leftDuration = leftRegion.endTime - leftRegion.startTime;
                const rightDuration = rightRegion.endTime - rightRegion.startTime;
                
                // Load sequentially to avoid race conditions with same audio file
                await engine.execute({
                    type: AudioCommandType.LOAD_REGION,
                    trackId,
                    regionId: leftRegion.id,
                    url: leftRegion.audioFile.url,
                    startTime: leftRegion.startTime,
                    startOffset: leftRegion.sourceStartTime,
                    duration: leftDuration,
                });
                
                await engine.execute({
                    type: AudioCommandType.LOAD_REGION,
                    trackId,
                    regionId: rightRegion.id,
                    url: rightRegion.audioFile.url,
                    startTime: rightRegion.startTime,
                    startOffset: rightRegion.sourceStartTime,
                    duration: rightDuration,
                });
                
                console.log(`[Split] AudioEngine sync completed for track ${trackId}`);
            } catch (error) {
                console.error(`[Split] AudioEngine sync failed:`, error);
                // TODO: Rollback store update if AudioEngine sync fails
            }
        })();
        },
        [getTrack, updateTrack]
    );

    return {
        splitRegion,
    };
};
