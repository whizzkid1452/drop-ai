import { useCallback } from 'react';
import { useCommandExecutor } from '@/layers/apps/web/context/LayerContext';
import { AudioCommandType } from '@/types/audioCommand.schema';

interface SplitRegionOptions {
  trackId: string;
  regionId: string;
  splitTime: number;
}

export const useTrackActions = () => {
  const commandExecutor = useCommandExecutor();

  const splitRegion = useCallback(
    async ({ trackId, regionId, splitTime }: SplitRegionOptions) => {
      await commandExecutor.execute({
        type: AudioCommandType.SPLIT_REGION,
        trackId,
        regionId,
        splitTime,
      });
    },
    [commandExecutor]
  );

  return {
    splitRegion,
  };
};
