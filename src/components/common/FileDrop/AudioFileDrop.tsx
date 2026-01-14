import type { AudioFile } from '@/types/audioFile';
import { convertFileToAudioFile } from '@/logics/audio/convertFileToAudioFile';
import { useAudioFileStore } from '@/stores/useAudioFileStore';
import { useTrackStore } from '@/stores/useTrackStore';
import { useCallback } from 'react';
import { BasicFileDrop } from './BaiscFileDrop';
import { useAudioEngine } from '@/hooks/audio/useAudioEngine';
import { RegionStatus, TrackStatus } from '@/types/track';

interface AudioFileDropProps {
  onAudioFileDrop?: (audioFile: AudioFile | null) => Promise<void> | void;
}

export const AudioFileDrop = ({ onAudioFileDrop }: AudioFileDropProps) => {
  const { addAudioFile, getAudioFile } = useAudioFileStore();
  const { addTrack } = useTrackStore();
  const audioEngine = useAudioEngine();
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
              sourceStartTime: 0,
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
      // CRITICAL: Set duration to prevent playing beyond region boundary
      const region = newTrack.regions[0];
      const regionDuration = region.endTime - region.startTime;
      
      await audioEngine.execute({
        type: 'LOAD_REGION',
        trackId,
        regionId,
        url: uploadedAudioFile.url,
        startTime: region.startTime,
        startOffset: region.sourceStartTime,
        duration: regionDuration,
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
