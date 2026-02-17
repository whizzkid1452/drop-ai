import type { AudioFile } from '@/types/audioFile';
import { convertFileToAudioFile } from '@/logics/audio/convertFileToAudioFile';
import { useAudioFileStore } from '@/stores/useAudioFileStore';
import { AudioService } from '@/core/audio/AudioService';
import { useCallback } from 'react';
import { BasicFileDrop } from './BasicFileDrop';

interface AudioFileDropProps {
  onAudioFileDrop?: (audioFile: AudioFile | null) => Promise<void> | void;
}

export const AudioFileDrop = ({ onAudioFileDrop }: AudioFileDropProps) => {
  const { addAudioFile, getAudioFile } = useAudioFileStore();
  // const { addTrack } = useTrackStore(); // Removed
  const onFileDrop = useCallback(
    async (file: File) => {
      const audioFileData = await convertFileToAudioFile(file);
      if (audioFileData == null) {
        onAudioFileDrop?.(null);
        return null;
      }
      addAudioFile({
        url: audioFileData.url,
        audioFile: audioFileData.audioFile,
      });
      const uploadedAudioFile = getAudioFile({ url: audioFileData.url });
      if (uploadedAudioFile == null) {
        onAudioFileDrop?.(null);
        return null;
      }

      const trackId = crypto.randomUUID();
      const regionId = crypto.randomUUID();
      const duration = uploadedAudioFile.duration ?? 0;

      // Use AudioService directly
      const service = AudioService.getInstance();

      // Note: addRegion in Service will internally create Track and Region in Domain
      await service.addRegion(trackId, {
        id: regionId,
        url: uploadedAudioFile.url,
        startTime: 0,
        sourceStartTime: 0,
        duration: duration,
        audioFile: uploadedAudioFile,
      });

      // Simple callback
      onAudioFileDrop?.(uploadedAudioFile);

      return uploadedAudioFile;
    },
    [addAudioFile, getAudioFile, onAudioFileDrop]
  );

  return (
    <BasicFileDrop
      onFileDrop={async file => {
        await onFileDrop(file);
      }}
    />
  );
};
