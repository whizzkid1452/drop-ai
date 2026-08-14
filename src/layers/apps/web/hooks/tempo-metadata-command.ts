import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';

interface TempoOptions {
  tempo: number;
}

interface ExecuteTempoChangeOptions extends TempoOptions {
  executeCommand: (command: AudioCommand) => Promise<unknown>;
  notifyFailure: (message: string) => void;
}

type SetTempoCommand = Extract<AudioCommand, { type: typeof AudioCommandType.SET_TEMPO }>;
export type TempoChangeResult = 'updated' | 'failed';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function parseTempoInput(value: string): number | null {
  if (value.trim() === '') {
    return null;
  }

  const tempo = Number(value);
  return Number.isFinite(tempo) && tempo > 0 ? tempo : null;
}

export function createSetTempoCommand({ tempo }: TempoOptions): SetTempoCommand {
  return {
    type: AudioCommandType.SET_TEMPO,
    tempo,
  };
}

export async function executeTempoChange({
  tempo,
  executeCommand,
  notifyFailure,
}: ExecuteTempoChangeOptions): Promise<TempoChangeResult> {
  try {
    await executeCommand(createSetTempoCommand({ tempo }));
    return 'updated';
  } catch (error) {
    notifyFailure(`Tempo를 변경하지 못했습니다: ${getErrorMessage(error)}`);
    return 'failed';
  }
}
