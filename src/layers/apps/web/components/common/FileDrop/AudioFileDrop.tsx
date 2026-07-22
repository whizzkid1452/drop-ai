import type { AudioFile } from '@/types/audioFile';
import { convertFileToAudioFile } from '@/utils/audio/convert-file-to-audio-file';
import { useCommandExecutor, useSession } from '@/layers/apps/web/context/layer-hooks';
import { useCallback } from 'react';
import { BasicFileDrop } from './BasicFileDrop';
import { createAudioImportCommands } from './audio-import-commands';

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

      // Track 생성이 Region 등록보다 먼저 끝나야 하므로 한 묶음의 입력 순서로 실행한다.
      await commandExecutor.executeMany(
        createAudioImportCommands({
          trackId,
          regionId,
          url: uploadedAudioFile.url,
          duration,
        })
      );

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
