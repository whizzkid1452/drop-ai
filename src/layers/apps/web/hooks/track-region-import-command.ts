import type { AudioFile } from '@/types/audioFile';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';

interface TrackRegionImportCommandOptions {
  trackId: string;
  regionId: string;
  url: string;
  startTime: number;
  duration: number;
}

export interface ConvertedAudioFile {
  audioFile: AudioFile;
  url: string;
}

interface ExecuteTrackRegionImportOptions {
  file: File;
  trackId: string;
  startTime: number;
  createRegionId: () => string;
  convertAudioFile: (file: File) => Promise<ConvertedAudioFile | null>;
  executeCommand: (command: AudioCommand) => Promise<unknown>;
  registerAudioFile: (url: string, audioFile: AudioFile) => void;
  releaseAudioUrl: (url: string) => void;
  notifyFailure: (message: string) => void;
}

type LoadRegionCommand = Extract<AudioCommand, { type: typeof AudioCommandType.LOAD_REGION }>;
export type TrackRegionImportResult = 'imported' | 'invalid-file' | 'failed';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createTrackRegionImportCommand({
  trackId,
  regionId,
  url,
  startTime,
  duration,
}: TrackRegionImportCommandOptions): LoadRegionCommand {
  return {
    type: AudioCommandType.LOAD_REGION,
    trackId,
    regionId,
    url,
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
  executeCommand,
  registerAudioFile,
  releaseAudioUrl,
  notifyFailure,
}: ExecuteTrackRegionImportOptions): Promise<TrackRegionImportResult> {
  const convertedAudioFile = await convertAudioFile(file);
  if (convertedAudioFile === null) {
    notifyFailure('오디오 파일을 읽지 못했습니다.');
    return 'invalid-file';
  }

  const duration = convertedAudioFile.audioFile.duration;
  if (duration === undefined || !Number.isFinite(duration) || duration <= 0) {
    releaseAudioUrl(convertedAudioFile.url);
    notifyFailure('오디오 길이를 확인하지 못했습니다.');
    return 'invalid-file';
  }

  const command = createTrackRegionImportCommand({
    trackId,
    regionId: createRegionId(),
    url: convertedAudioFile.url,
    startTime,
    duration,
  });

  try {
    await executeCommand(command);
  } catch (error) {
    releaseAudioUrl(convertedAudioFile.url);
    notifyFailure(`Region을 추가하지 못했습니다: ${getErrorMessage(error)}`);
    return 'failed';
  }

  registerAudioFile(convertedAudioFile.url, convertedAudioFile.audioFile);
  return 'imported';
}
