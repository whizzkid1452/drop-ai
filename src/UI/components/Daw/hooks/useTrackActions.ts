import { useAudioServiceActions } from '@/FACADE/useEngineFacade';

/**
 * @deprecated Use useAudioServiceActions() directly instead.
 * This hook is kept for backward compatibility but will be removed.
 */
export const useTrackActions = () => {
    const { splitRegion } = useAudioServiceActions();
    return { splitRegion };
};
