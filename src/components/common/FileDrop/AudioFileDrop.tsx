import type { AudioFile } from '@/types/audioFile';
import { convertFileToAudioFile } from '@/logics/audio/convertFileToAudioFile';
import { useAudioFileStore } from '@/stores/use-audio-file-store';
import { useCallback } from 'react';
import { BasicFileDrop } from './BaiscFileDrop';

interface AudioFileDrop {
  onAudioFileDrop: (audioFile: AudioFile | null) => Promise<void> | void;
}

export const AudioFileDrop = ({ onAudioFileDrop }: AudioFileDrop) => {
  const { addAudioFile, getAudioFile } = useAudioFileStore();
  const onFileDrop = useCallback(async (file: File) => {
    const audioFileData = await convertFileToAudioFile(file);
    if (audioFileData == null) {
      return null;
    }
    addAudioFile({
      url: audioFileData.url,
      audioFile: audioFileData.audioFile,
    });
    const uploadedAudioFile = getAudioFile({ url: audioFileData.url });
    if (uploadedAudioFile == null) {
      return null;
    }
    return uploadedAudioFile;
  }, []);

  return (
    <BasicFileDrop
      onFileDrop={async file => {
        const uploadedAudioFile = await onFileDrop(file);
        await onAudioFileDrop(uploadedAudioFile);
      }}
    />
  );
};
