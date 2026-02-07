import { useCallback } from 'react';
import { AudioService } from '@/FACADE/Facade';

export const useTrackActions = () => {
    /**
     * Split a region at the specified time
     * @param trackId - The ID of the track containing the region
     * @param splitTime - The timeline position (in seconds) to split at
     */
    const splitRegion = useCallback(
        async (trackId: string, splitTime: number) => {
            const service = AudioService.getInstance();
            await service.splitRegion(trackId, splitTime);
        },
        []
    );

    return {
        splitRegion,
    };
};
