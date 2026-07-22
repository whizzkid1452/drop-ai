import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import type { StagedWebAudioSource } from '@/layers/apps/web/hooks/stage-web-audio-source';

interface CreateAudioImportCommandsOptions {
  trackId: string;
  regionId: string;
  stagedSource: StagedWebAudioSource;
}

export function createAudioImportCommands({
  trackId,
  regionId,
  stagedSource,
}: CreateAudioImportCommandsOptions): readonly AudioCommand[] {
  return [
    {
      type: AudioCommandType.ADD_TRACK,
      trackId,
    },
    {
      type: AudioCommandType.LOAD_REGION,
      trackId,
      regionId,
      sourceId: stagedSource.sourceId,
      startTime: 0,
      startOffset: 0,
      duration: stagedSource.audioFile.duration ?? 0,
    },
  ];
}
