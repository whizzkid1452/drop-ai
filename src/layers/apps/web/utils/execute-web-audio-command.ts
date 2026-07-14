import type { AppController } from '../../../controllers/app-controller';
import { executeAudioCommand } from '../../../controllers/utils/command-dispatcher';
import type { SessionState } from '../../../session/session';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import { downloadBlob } from '../components/Daw/components/ExportButton/utils/audioExport';

interface ExecuteWebAudioCommandOptions {
  controller: AppController;
  session: SessionState;
  command: AudioCommand;
}

export async function executeWebAudioCommand({
  controller,
  session,
  command,
}: ExecuteWebAudioCommandOptions): Promise<void> {
  const result = await executeAudioCommand({ controller, session, command });
  if (!(result instanceof Blob)) return;

  const filename = command.type === AudioCommandType.EXPORT_AUDIO ? command.filename || 'export' : 'export';
  downloadBlob(result, `${filename}.wav`);
}
