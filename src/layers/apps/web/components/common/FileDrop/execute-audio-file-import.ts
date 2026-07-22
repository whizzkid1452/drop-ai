import type { IAudioSourceStager } from '@/layers/audio-source-registry/i-audio-source-registry';
import {
  AudioImportCompensationError,
  type AudioImportCompensationFailure,
} from '@/layers/apps/web/audio-import-errors';
import { CommandBatchExecutionError, type CommandExecutor } from '@/layers/commands/command-executor';
import type { StagedWebAudioSource } from '@/layers/apps/web/hooks/stage-web-audio-source';
import type { AudioFile } from '@/types/audioFile';
import { AudioCommandType } from '@/types/audioCommand.schema';
import { createAudioImportCommands } from './audio-import-commands';

interface ExecuteAudioFileImportOptions {
  commandExecutor: Pick<CommandExecutor, 'execute' | 'executeMany'>;
  audioSourceStager: Pick<IAudioSourceStager, 'discardPending'>;
  stagedSource: StagedWebAudioSource;
  trackId: string;
  regionId: string;
}

interface CompensateAudioFileImportOptions {
  commandExecutor: ExecuteAudioFileImportOptions['commandExecutor'];
  audioSourceStager: ExecuteAudioFileImportOptions['audioSourceStager'];
  sourceId: string;
  trackId: string;
  shouldRemoveTrack: boolean;
}

async function compensateAudioFileImport({
  commandExecutor,
  audioSourceStager,
  sourceId,
  trackId,
  shouldRemoveTrack,
}: CompensateAudioFileImportOptions): Promise<readonly AudioImportCompensationFailure[]> {
  const compensationFailures: AudioImportCompensationFailure[] = [];

  if (shouldRemoveTrack) {
    try {
      await commandExecutor.execute({ type: AudioCommandType.REMOVE_TRACK, trackId });
    } catch (cause) {
      compensationFailures.push({ step: `Track 제거: ${trackId}`, cause });
    }
  }

  try {
    audioSourceStager.discardPending(sourceId);
  } catch (cause) {
    compensationFailures.push({ step: `pending Source 정리: ${sourceId}`, cause });
  }

  return compensationFailures;
}

function getFailedPhase(error: unknown): string {
  if (error instanceof CommandBatchExecutionError) {
    return `${error.failedCommand.type} 실행`;
  }

  return '명령 묶음 검증 또는 실행';
}

export async function executeAudioFileImport({
  commandExecutor,
  audioSourceStager,
  stagedSource,
  trackId,
  regionId,
}: ExecuteAudioFileImportOptions): Promise<AudioFile> {
  const commands = createAudioImportCommands({ trackId, regionId, stagedSource });

  try {
    await commandExecutor.executeMany(commands);
  } catch (cause) {
    const shouldRemoveTrack = cause instanceof CommandBatchExecutionError && cause.failedIndex === 1;
    const compensationFailures = await compensateAudioFileImport({
      commandExecutor,
      audioSourceStager,
      sourceId: stagedSource.sourceId,
      trackId,
      shouldRemoveTrack,
    });

    if (compensationFailures.length > 0) {
      throw new AudioImportCompensationError({
        operation: 'audio-file-import',
        failedPhase: getFailedPhase(cause),
        cause,
        compensationFailures,
      });
    }

    throw cause;
  }

  return stagedSource.audioFile;
}
