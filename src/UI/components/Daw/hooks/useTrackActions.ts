import { useAudioServiceActions } from '@/AudioEngine/FACADE/useAudioEngineFacade';

/**
 * @deprecated Use useAudioServiceActions() directly instead.
 * This hook is kept for backward compatibility but will be removed.
 */
export const useTrackActions = () => {
    const { splitRegion } = useAudioServiceActions();
    return { splitRegion };
};
