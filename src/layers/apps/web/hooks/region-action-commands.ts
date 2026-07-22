import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';

interface RegionTarget {
  trackId: string;
  regionId: string;
}

interface ConfirmedRegionRemovalOptions extends RegionTarget {
  confirmRemoval: () => boolean;
  executeCommand: (command: AudioCommand) => Promise<unknown>;
  notifyFailure: (message: string) => void;
}

type UnloadRegionCommand = Extract<AudioCommand, { type: typeof AudioCommandType.UNLOAD_REGION }>;
export type RegionRemovalResult = 'cancelled' | 'removed' | 'failed';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createUnloadRegionCommand({ trackId, regionId }: RegionTarget): UnloadRegionCommand {
  return {
    type: AudioCommandType.UNLOAD_REGION,
    trackId,
    regionId,
  };
}

export async function executeConfirmedRegionRemoval({
  trackId,
  regionId,
  confirmRemoval,
  executeCommand,
  notifyFailure,
}: ConfirmedRegionRemovalOptions): Promise<RegionRemovalResult> {
  if (!confirmRemoval()) {
    return 'cancelled';
  }

  try {
    await executeCommand(createUnloadRegionCommand({ trackId, regionId }));
    return 'removed';
  } catch (error) {
    notifyFailure(`Region을 삭제하지 못했습니다: ${getErrorMessage(error)}`);
    return 'failed';
  }
}
