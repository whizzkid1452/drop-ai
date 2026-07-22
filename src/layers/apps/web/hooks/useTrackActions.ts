import { useCallback } from 'react';
import { useCommandExecutor } from '@/layers/apps/web/context/LayerContext';
import { AudioCommandType } from '@/types/audioCommand.schema';
import { executeConfirmedRegionRemoval, executeRegionMove } from './region-action-commands';

interface SplitRegionOptions {
  trackId: string;
  regionId: string;
  splitTime: number;
}

interface RemoveRegionOptions {
  trackId: string;
  regionId: string;
}

interface MoveRegionOptions {
  trackId: string;
  regionId: string;
  newStartTime: number;
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

  const removeRegion = useCallback(
    async (options: RemoveRegionOptions) => {
      return executeConfirmedRegionRemoval({
        ...options,
        confirmRemoval: () => window.confirm('이 Region을 삭제할까요?'),
        executeCommand: command => commandExecutor.execute(command),
        notifyFailure: message => window.alert(message),
      });
    },
    [commandExecutor]
  );

  const moveRegion = useCallback(
    async (options: MoveRegionOptions) => {
      return executeRegionMove({
        ...options,
        executeCommand: command => commandExecutor.execute(command),
        notifyFailure: message => window.alert(message),
      });
    },
    [commandExecutor]
  );

  return {
    moveRegion,
    removeRegion,
    splitRegion,
  };
};
