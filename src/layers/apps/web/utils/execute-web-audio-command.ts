import type { CommandExecutor } from '../../../commands/command-executor';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import { downloadBlob } from '../components/Daw/components/ExportButton/utils/audioExport';

interface ExecuteWebAudioCommandOptions {
  commandExecutor: CommandExecutor;
  command: AudioCommand;
}

export async function executeWebAudioCommand({
  commandExecutor,
  command,
}: ExecuteWebAudioCommandOptions): Promise<void> {
  const result = await commandExecutor.execute(command);
  if (!(result instanceof Blob)) return;

  const filename = command.type === AudioCommandType.EXPORT_AUDIO ? command.filename || 'export' : 'export';
  downloadBlob(result, `${filename}.wav`);
}
