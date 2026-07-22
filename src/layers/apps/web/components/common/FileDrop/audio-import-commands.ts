import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';

interface CreateAudioImportCommandsOptions {
  trackId: string;
  regionId: string;
  url: string;
  duration: number;
}

export function createAudioImportCommands({
  trackId,
  regionId,
  url,
  duration,
}: CreateAudioImportCommandsOptions): readonly AudioCommand[] {
  return [
    {
      type: AudioCommandType.ADD_TRACK,
      trackId,
      url,
    },
    {
      type: AudioCommandType.LOAD_REGION,
      trackId,
      regionId,
      url,
      startTime: 0,
      startOffset: 0,
      duration,
    },
  ];
}
