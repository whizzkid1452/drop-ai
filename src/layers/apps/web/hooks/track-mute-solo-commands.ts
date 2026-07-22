import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';

interface TrackTarget {
  trackId: string;
}

interface TrackMuteOptions extends TrackTarget {
  muted: boolean;
}

interface TrackSoloOptions extends TrackTarget {
  soloed: boolean;
}

interface CommandExecutionOptions {
  executeCommand: (command: AudioCommand) => Promise<unknown>;
  notifyFailure: (message: string) => void;
}

interface TrackToggleExecutionOptions extends CommandExecutionOptions {
  command: SetTrackMuteCommand | SetTrackSoloCommand;
  controlName: 'Mute' | 'Solo';
}

type SetTrackMuteCommand = Extract<AudioCommand, { type: typeof AudioCommandType.SET_TRACK_MUTE }>;
type SetTrackSoloCommand = Extract<AudioCommand, { type: typeof AudioCommandType.SET_TRACK_SOLO }>;
export type TrackToggleResult = 'updated' | 'failed';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function executeTrackToggle({
  command,
  controlName,
  executeCommand,
  notifyFailure,
}: TrackToggleExecutionOptions): Promise<TrackToggleResult> {
  try {
    await executeCommand(command);
    return 'updated';
  } catch (error) {
    notifyFailure(`Track ${controlName}를 변경하지 못했습니다: ${getErrorMessage(error)}`);
    return 'failed';
  }
}

export function createSetTrackMuteCommand({ trackId, muted }: TrackMuteOptions): SetTrackMuteCommand {
  return {
    type: AudioCommandType.SET_TRACK_MUTE,
    trackId,
    muted,
  };
}

export function createSetTrackSoloCommand({ trackId, soloed }: TrackSoloOptions): SetTrackSoloCommand {
  return {
    type: AudioCommandType.SET_TRACK_SOLO,
    trackId,
    soloed,
  };
}

export function executeTrackMuteChange({
  trackId,
  muted,
  executeCommand,
  notifyFailure,
}: TrackMuteOptions & CommandExecutionOptions): Promise<TrackToggleResult> {
  return executeTrackToggle({
    command: createSetTrackMuteCommand({ trackId, muted }),
    controlName: 'Mute',
    executeCommand,
    notifyFailure,
  });
}

export function executeTrackSoloChange({
  trackId,
  soloed,
  executeCommand,
  notifyFailure,
}: TrackSoloOptions & CommandExecutionOptions): Promise<TrackToggleResult> {
  return executeTrackToggle({
    command: createSetTrackSoloCommand({ trackId, soloed }),
    controlName: 'Solo',
    executeCommand,
    notifyFailure,
  });
}
