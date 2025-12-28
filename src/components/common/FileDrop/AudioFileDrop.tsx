import type { AudioFile } from '@/types/audioFile';
import { convertFileToAudioFile } from '@/logics/audio/convertFileToAudioFile';
import { useAudioFileStore } from '@/stores/useAudioFileStore';
import { useTrackStore } from '@/stores/useTrackStore';
import { RegionStatus, TrackStatus } from '@/types/track';
import { useCallback } from 'react';
import { BasicFileDrop } from './BaiscFileDrop';

interface AudioFileDrop {
  onAudioFileDrop?: (audioFile: AudioFile | null) => Promise<void> | void;
}

export const AudioFileDrop = ({ onAudioFileDrop }: AudioFileDrop) => {
  const { addAudioFile, getAudioFile } = useAudioFileStore();
  const { addTrack } = useTrackStore();
  const onFileDrop = useCallback(
    async (file: File) => {
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

      // AudioFileDrop은 자동으로 Track을 추가합니다.
      addTrack({
        track: {
          id: crypto.randomUUID(),
          regions: [
            {
              id: crypto.randomUUID(),
              startTime: 0,
              endTime: uploadedAudioFile.duration ?? 0,
              audioFile: uploadedAudioFile,
              status: [RegionStatus.active],
            },
          ],
          status: [TrackStatus.normal],
          volume: 1,
          pan: 0,
        },
      });

      return uploadedAudioFile;
    },
    [addAudioFile, getAudioFile, addTrack]
  );

  return (
    <BasicFileDrop
      onFileDrop={async file => {
        const uploadedAudioFile = await onFileDrop(file);
        await onAudioFileDrop?.(uploadedAudioFile);
      }}
    />
  );
};
