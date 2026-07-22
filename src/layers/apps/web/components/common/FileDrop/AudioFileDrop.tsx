import type { AudioFile } from '@/types/audioFile';
import { convertFileToAudioFile } from '@/utils/audio/convert-file-to-audio-file';
import { useCommandExecutor, useSession } from '@/layers/apps/web/context/LayerContext';
import { useCallback } from 'react';
import { BasicFileDrop } from './BasicFileDrop';
import { AudioCommandType } from '@/types/audioCommand.schema';

interface AudioFileDropProps {
  onAudioFileDrop?: (audioFile: AudioFile | null) => Promise<void> | void;
}

export const AudioFileDrop = ({ onAudioFileDrop }: AudioFileDropProps) => {
  const addAudioFile = useSession(state => state.addAudioFile);
  const commandExecutor = useCommandExecutor();

  const onFileDrop = useCallback(
    async (file: File) => {
      const audioFileData = await convertFileToAudioFile(file);
      if (audioFileData == null) {
        onAudioFileDrop?.(null);
        return null;
      }

      addAudioFile(audioFileData.url, audioFileData.audioFile);
      const uploadedAudioFile = audioFileData.audioFile;

      const trackId = crypto.randomUUID();
      const regionId = crypto.randomUUID();
      const duration = uploadedAudioFile.duration ?? 0;

      // Track을 먼저 만든 뒤 Region을 등록해야 AudioEngine 채널과 Session 상태가 같은 ID를 공유한다.
      await commandExecutor.execute({
        type: AudioCommandType.ADD_TRACK,
        trackId,
        url: uploadedAudioFile.url,
      });
      await commandExecutor.execute({
        type: AudioCommandType.LOAD_REGION,
        trackId,
        regionId,
        url: uploadedAudioFile.url,
        startTime: 0,
        startOffset: 0,
        duration,
      });

      onAudioFileDrop?.(uploadedAudioFile);

      return uploadedAudioFile;
    },
    [addAudioFile, commandExecutor, onAudioFileDrop]
  );

  return (
    <BasicFileDrop
      onFileDrop={async file => {
        await onFileDrop(file);
      }}
    />
  );
};
