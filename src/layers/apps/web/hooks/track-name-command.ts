import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';

export const TRACK_NAME_MAX_LENGTH = 255;

interface TrackNameOptions {
  readonly name: string;
  readonly trackId: string;
}

interface ExecuteTrackNameChangeOptions extends TrackNameOptions {
  readonly executeCommand: (command: AudioCommand) => Promise<unknown>;
  readonly notifyFailure: (message: string) => void;
}

type SetTrackNameCommand = Extract<AudioCommand, { type: typeof AudioCommandType.SET_TRACK_NAME }>;
export type TrackNameChangeResult = 'updated' | 'failed';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function normalizeTrackName(value: string): string | null {
  const normalizedName = value.trim();
  const isValidLength = normalizedName.length > 0 && normalizedName.length <= TRACK_NAME_MAX_LENGTH;
  return isValidLength ? normalizedName : null;
}

export function createSetTrackNameCommand({ trackId, name }: TrackNameOptions): SetTrackNameCommand {
  return {
    type: AudioCommandType.SET_TRACK_NAME,
    trackId,
    name,
  };
}

export async function executeTrackNameChange({
  trackId,
  name,
  executeCommand,
  notifyFailure,
}: ExecuteTrackNameChangeOptions): Promise<TrackNameChangeResult> {
  try {
    await executeCommand(createSetTrackNameCommand({ trackId, name }));
    return 'updated';
  } catch (error) {
    notifyFailure(`Track 이름을 변경하지 못했습니다: ${getErrorMessage(error)}`);
    return 'failed';
  }
}
