import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';

interface TrackTarget {
  trackId: string;
}

interface ConfirmedTrackRemovalOptions extends TrackTarget {
  confirmRemoval: () => boolean;
  executeCommand: (command: AudioCommand) => Promise<unknown>;
  notifyFailure: (message: string) => void;
}

type RemoveTrackCommand = Extract<AudioCommand, { type: typeof AudioCommandType.REMOVE_TRACK }>;
export type TrackRemovalResult = 'cancelled' | 'removed' | 'failed';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createRemoveTrackCommand({ trackId }: TrackTarget): RemoveTrackCommand {
  return {
    type: AudioCommandType.REMOVE_TRACK,
    trackId,
  };
}

export async function executeConfirmedTrackRemoval({
  trackId,
  confirmRemoval,
  executeCommand,
  notifyFailure,
}: ConfirmedTrackRemovalOptions): Promise<TrackRemovalResult> {
  if (!confirmRemoval()) {
    return 'cancelled';
  }

  try {
    await executeCommand(createRemoveTrackCommand({ trackId }));
    return 'removed';
  } catch (error) {
    notifyFailure(`Track을 삭제하지 못했습니다: ${getErrorMessage(error)}`);
    return 'failed';
  }
}
