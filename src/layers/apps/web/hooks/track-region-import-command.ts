import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import type { AudioFileMetadata } from '@/utils/audio/convert-file-to-audio-file';
import { AudioImportCompensationError } from '@/layers/apps/web/audio-import-errors';
import type { StagedWebAudioSource } from './stage-web-audio-source';

interface TrackRegionImportCommandOptions {
  trackId: string;
  regionId: string;
  sourceId: string;
  startTime: number;
  duration: number;
}

export interface ExecuteTrackRegionImportOptions {
  file: File;
  trackId: string;
  startTime: number;
  createRegionId: () => string;
  convertAudioFile: (file: File) => Promise<AudioFileMetadata | null>;
  stageAudioSource: (audioFileMetadata: AudioFileMetadata) => StagedWebAudioSource;
  discardPendingSource: (sourceId: string) => void;
  executeCommand: (command: AudioCommand) => Promise<unknown>;
  notifyFailure: (message: string, error?: unknown) => void;
}

type LoadRegionCommand = Extract<AudioCommand, { type: typeof AudioCommandType.LOAD_REGION }>;
export type TrackRegionImportResult = 'imported' | 'invalid-file' | 'failed';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface ReportCommandFailureOptions {
  commandFailure: unknown;
  sourceId: string;
  discardPendingSource: (sourceId: string) => void;
  notifyFailure: (message: string, error?: unknown) => void;
}

function reportCommandFailure({
  commandFailure,
  sourceId,
  discardPendingSource,
  notifyFailure,
}: ReportCommandFailureOptions): void {
  const commandFailureMessage = getErrorMessage(commandFailure);

  try {
    discardPendingSource(sourceId);
  } catch (discardFailure) {
    const compensationError = new AudioImportCompensationError({
      operation: 'track-region-import',
      failedPhase: 'LOAD_REGION 실행',
      cause: commandFailure,
      compensationFailures: [{ step: 'pending Source 정리', cause: discardFailure }],
    });
    notifyFailure(
      `Region을 추가하지 못했습니다. ${commandFailureMessage} pending Source 정리도 실패했습니다: ${getErrorMessage(discardFailure)}`,
      compensationError
    );
    return;
  }

  notifyFailure(`Region을 추가하지 못했습니다. ${commandFailureMessage}`, commandFailure);
}

export function createTrackRegionImportCommand({
  trackId,
  regionId,
  sourceId,
  startTime,
  duration,
}: TrackRegionImportCommandOptions): LoadRegionCommand {
  return {
    type: AudioCommandType.LOAD_REGION,
    trackId,
    regionId,
    sourceId,
    startTime,
    startOffset: 0,
    duration,
  };
}

export async function executeTrackRegionImport({
  file,
  trackId,
  startTime,
  createRegionId,
  convertAudioFile,
  stageAudioSource,
  discardPendingSource,
  executeCommand,
  notifyFailure,
}: ExecuteTrackRegionImportOptions): Promise<TrackRegionImportResult> {
  const audioFileMetadata = await convertAudioFile(file);
  if (audioFileMetadata === null) {
    notifyFailure('오디오 파일을 읽지 못했습니다.');
    return 'invalid-file';
  }

  const duration = audioFileMetadata.duration;
  if (duration === undefined || !Number.isFinite(duration) || duration <= 0) {
    notifyFailure('오디오 길이를 확인하지 못했습니다.');
    return 'invalid-file';
  }

  let stagedAudioSource: StagedWebAudioSource;
  try {
    stagedAudioSource = stageAudioSource(audioFileMetadata);
  } catch (stageFailure) {
    notifyFailure(`오디오 Source를 준비하지 못했습니다. ${getErrorMessage(stageFailure)}`, stageFailure);
    return 'failed';
  }

  try {
    const command = createTrackRegionImportCommand({
      trackId,
      regionId: createRegionId(),
      sourceId: stagedAudioSource.sourceId,
      startTime,
      duration,
    });
    await executeCommand(command);
  } catch (commandFailure) {
    reportCommandFailure({
      commandFailure,
      sourceId: stagedAudioSource.sourceId,
      discardPendingSource,
      notifyFailure,
    });
    return 'failed';
  }

  return 'imported';
}
