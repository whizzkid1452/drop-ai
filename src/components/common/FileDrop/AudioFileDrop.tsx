import type { AudioFile } from '@/types/audioFile';
import { convertFileToAudioFile } from '@/logics/audio/convertFileToAudioFile';
import { useAudioFileStore } from '@/stores/useAudioFileStore';
import { useTrackStore } from '@/stores/useTrackStore';
import { useCallback } from 'react';
import { BasicFileDrop } from './BaiscFileDrop';
import { AudioEngine } from '@/logics/audio/audioEngine';

interface AudioFileDropProps {
  onAudioFileDrop?: (audioFile: AudioFile | null) => Promise<void> | void;
}

import { RegionStatus, TrackStatus } from '@/types/track';

export const AudioFileDrop = ({ onAudioFileDrop }: AudioFileDropProps) => {
  const { addAudioFile, getAudioFile } = useAudioFileStore();
  const { addTrack } = useTrackStore();
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

      const newTrack = addTrack({
        track: {
          regions: [
            {
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

      const trackId = newTrack.id;
      const regionId = newTrack.regions[0].id;

      // Direct Dependency: Load into AudioEngine immediately
      AudioEngine.getInstance().execute({
        command: {
          type: 'LOAD_REGION',
          trackId,
          regionId,
          url: uploadedAudioFile.url,
          startTime: 0,
        },
      });

      // Simple callback
      onAudioFileDrop?.(uploadedAudioFile);

      return uploadedAudioFile;
    },
    [addAudioFile, getAudioFile, addTrack, onAudioFileDrop]
  );

  return (
    <BasicFileDrop
      onFileDrop={async file => {
        await onFileDrop(file);
      }}
    />
  );
};
