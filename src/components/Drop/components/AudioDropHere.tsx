import type { AudioFile } from '@/components/Daw/components/FileUpload/components/types';
import { convertFileToAudioFile } from '@/logics/audio/convertFileToAudioFile';
import { useAudioFileStore } from '@/stores/use-audio-file-store';
import { useCallback } from 'react';
import { DropHere } from './DropHere';

export const AudioDropHere = ({
  onAudioFileDrop,
}: {
  onAudioFileDrop: (audioFile: AudioFile | null) => Promise<void> | void;
}) => {
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
    <DropHere
      onFileDrop={async file => {
        const uploadedAudioFile = await onFileDrop(file);
        await onAudioFileDrop(uploadedAudioFile);
      }}
    />
  );
};
