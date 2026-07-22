import { CommandBatchExecutionError, type CommandExecutor } from '@/layers/commands/command-executor';
import { downloadWebAudioCommandResults } from '@/layers/apps/web/utils/execute-web-audio-command';
import type { AudioCommand } from '@/types/audioCommand.schema';

interface ExecuteJsonCliCommandBatchOptions {
  commandExecutor: Pick<CommandExecutor, 'executeMany'>;
  commands: readonly AudioCommand[];
}

interface JsonCliCommandBatchOutcome {
  completedCommands: readonly AudioCommand[];
  batchError: CommandBatchExecutionError | null;
}

export async function executeJsonCliCommandBatch({
  commandExecutor,
  commands,
}: ExecuteJsonCliCommandBatchOptions): Promise<JsonCliCommandBatchOutcome> {
  try {
    const results = await commandExecutor.executeMany(commands);
    downloadWebAudioCommandResults({ commands, results });
    return { completedCommands: commands, batchError: null };
  } catch (error) {
    if (!(error instanceof CommandBatchExecutionError)) {
      throw error;
    }

    downloadWebAudioCommandResults({ commands, results: error.completedResults });
    return {
      completedCommands: commands.slice(0, error.failedIndex),
      batchError: error,
    };
  }
}
