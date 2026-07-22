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

interface MoveRegionOptions extends RegionTarget {
  newStartTime: number;
}

interface ExecuteRegionMoveOptions extends MoveRegionOptions {
  executeCommand: (command: AudioCommand) => Promise<unknown>;
  notifyFailure: (message: string) => void;
}

type UnloadRegionCommand = Extract<AudioCommand, { type: typeof AudioCommandType.UNLOAD_REGION }>;
type MoveRegionCommand = Extract<AudioCommand, { type: typeof AudioCommandType.MOVE_REGION }>;
export type RegionRemovalResult = 'cancelled' | 'removed' | 'failed';
export type RegionMoveResult = 'moved' | 'failed';

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

export function createMoveRegionCommand({ trackId, regionId, newStartTime }: MoveRegionOptions): MoveRegionCommand {
  return {
    type: AudioCommandType.MOVE_REGION,
    trackId,
    regionId,
    newStartTime,
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

export async function executeRegionMove({
  trackId,
  regionId,
  newStartTime,
  executeCommand,
  notifyFailure,
}: ExecuteRegionMoveOptions): Promise<RegionMoveResult> {
  try {
    await executeCommand(createMoveRegionCommand({ trackId, regionId, newStartTime }));
    return 'moved';
  } catch (error) {
    notifyFailure(`Region을 이동하지 못했습니다: ${getErrorMessage(error)}`);
    return 'failed';
  }
}
