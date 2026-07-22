import type { CommandBatchExecutionResult, CommandExecutor } from '../../../commands/command-executor';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import { downloadBlob } from '../components/Daw/components/ExportButton/utils/audioExport';

interface ExecuteWebAudioCommandOptions {
  commandExecutor: Pick<CommandExecutor, 'execute'>;
  command: AudioCommand;
}

interface DownloadWebAudioCommandResultsOptions {
  commands: readonly AudioCommand[];
  results: CommandBatchExecutionResult;
}

export function downloadWebAudioCommandResults({ commands, results }: DownloadWebAudioCommandResultsOptions): void {
  for (const [index, result] of results.entries()) {
    const command = commands[index];
    if (!(result instanceof Blob) || command?.type !== AudioCommandType.EXPORT_AUDIO) {
      continue;
    }

    downloadBlob(result, `${command.filename || 'export'}.wav`);
  }
}

export async function executeWebAudioCommand({
  commandExecutor,
  command,
}: ExecuteWebAudioCommandOptions): Promise<void> {
  const result = await commandExecutor.execute(command);
  downloadWebAudioCommandResults({ commands: [command], results: [result] });
}
