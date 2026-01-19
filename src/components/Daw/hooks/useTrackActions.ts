import { AudioEngine } from '@/logics/audio/audioEngine';
import { useTrackStore } from '@/stores/useTrackStore';
import { RegionRenderer } from '@/logics/audio/regionRenderer';
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

            const result = RegionRenderer.calculateSplitRegion(region, splitTime);

            if (!result) {
                console.warn(`[Split] Failed: splitTime ${splitTime} is outside region range [${region.startTime}, ${region.endTime}]`);
                return;
            }
            
            console.log(`[Split] Splitting region ${region.id} at ${splitTime}s (range: ${region.startTime}~${region.endTime})`);

            const { left: leftRegion, right: rightRegion } = result;

            updateTrack({
                trackId,
                updater: t => {
                    const otherRegions = t.regions.filter(r => r.id !== region.id);
                    const newRegions = [...otherRegions, leftRegion, rightRegion];
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
                
                await engine.execute({
                    type: AudioCommandType.UNLOAD_REGION,
                    trackId,
                    regionId: region.id,
                });

                const leftParams = RegionRenderer.calculateRenderParams(leftRegion);
                const rightParams = RegionRenderer.calculateRenderParams(rightRegion);
                
                await engine.execute({
                    type: AudioCommandType.LOAD_REGION,
                    trackId,
                    regionId: leftRegion.id,
                    url: leftParams.url,
                    startTime: leftParams.startTime,
                    startOffset: leftParams.startOffset,
                    duration: leftParams.duration,
                });
                
                await engine.execute({
                    type: AudioCommandType.LOAD_REGION,
                    trackId,
                    regionId: rightRegion.id,
                    url: rightParams.url,
                    startTime: rightParams.startTime,
                    startOffset: rightParams.startOffset,
                    duration: rightParams.duration,
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
