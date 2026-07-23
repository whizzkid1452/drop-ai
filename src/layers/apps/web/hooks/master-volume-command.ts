import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';

const MIN_MASTER_VOLUME = 0;
const MAX_MASTER_VOLUME = 1;

interface MasterVolumeOptions {
  volume: number;
}

interface ExecuteMasterVolumeChangeOptions extends MasterVolumeOptions {
  executeCommand: (command: AudioCommand) => Promise<unknown>;
  notifyFailure: (message: string) => void;
}

type SetMasterVolumeCommand = Extract<AudioCommand, { type: typeof AudioCommandType.SET_MASTER_VOLUME }>;
export type MasterVolumeChangeResult = 'updated' | 'failed';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function parseMasterVolumeInput(value: string): number | null {
  if (value.trim() === '') {
    return null;
  }

  const volume = Number(value);
  const isInRange = volume >= MIN_MASTER_VOLUME && volume <= MAX_MASTER_VOLUME;
  return Number.isFinite(volume) && isInRange ? volume : null;
}

export function createSetMasterVolumeCommand({ volume }: MasterVolumeOptions): SetMasterVolumeCommand {
  return {
    type: AudioCommandType.SET_MASTER_VOLUME,
    volume,
  };
}

export async function executeMasterVolumeChange({
  volume,
  executeCommand,
  notifyFailure,
}: ExecuteMasterVolumeChangeOptions): Promise<MasterVolumeChangeResult> {
  try {
    await executeCommand(createSetMasterVolumeCommand({ volume }));
    return 'updated';
  } catch (error) {
    notifyFailure(`Master Volume을 변경하지 못했습니다: ${getErrorMessage(error)}`);
    return 'failed';
  }
}
