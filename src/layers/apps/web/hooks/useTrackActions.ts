import { useCallback } from 'react';
import { useController } from '@/layers/apps/web/context/LayerContext';

export const useTrackActions = () => {
    const controller = useController();

    /**
     * Split a region at the specified time
     * @param trackId - The ID of the track containing the region
     * @param splitTime - The timeline position (in seconds) to split at
     */
    const splitRegion = useCallback(
        async (trackId: string, splitTime: number) => {
            await controller.region.splitRegion(trackId, splitTime);
        },
        [controller]
    );

    const moveRegion = useCallback(
        (params: { trackId: string; regionId: string; newStartTime: number }) => {
            controller.region.moveRegion(params);
        },
        [controller]
    );

    return {
        splitRegion,
        moveRegion,
    };
};
