import type { AudioFile } from '@/types/audioFile';
import { convertFileToAudioFile } from '@/utils/audio/convert-file-to-audio-file';
import { useSession, useController } from '@/layers/presentation/context/LayerContext';
import { useCallback } from 'react';
import { BasicFileDrop } from './BasicFileDrop';

interface AudioFileDropProps {
  onAudioFileDrop?: (audioFile: AudioFile | null) => Promise<void> | void;
}

export const AudioFileDrop = ({ onAudioFileDrop }: AudioFileDropProps) => {
  const addAudioFile = useSession(state => state.addAudioFile);
  const controller = useController();
  
  const onFileDrop = useCallback(
    async (file: File) => {
      const audioFileData = await convertFileToAudioFile(file);
      if (audioFileData == null) {
        onAudioFileDrop?.(null);
        return null;
      }
      
      // Update Session Store (Audio Files)
      addAudioFile(audioFileData.url, audioFileData.audioFile);
      
      // We don't need getAudioFile because we just added it and have the data.
      const uploadedAudioFile = audioFileData.audioFile;

      const trackId = crypto.randomUUID();
      const regionId = crypto.randomUUID();
      const duration = uploadedAudioFile.duration ?? 0;

      // Use Controller to add region
      // Track adding is implicit in AudioEngine if we use addRegion on a new trackId?
      // Wait, AudioEngine.addRegion usually requires track to exist in Tone.js?
      // AudioService.addRegion logic:
      // "Note: addRegion in Service will internally create Track and Region in Domain"
      // My RegionController.addRegion calls audioEngine.addRegion.
      // Does AudioEngine auto-create track?
      // If not, I should call controller.track.addTrack first.
      // AudioService.addRegion implementation likely did both.
      // Let's check if AudioEngine handles it or if I need to do it.
      // Assuming for now I should add track first to be safe, or just call addRegion if engine handles it.
      // But looking at TrackController, addTrack calls audioEngine.loadTrack which loads Player.
      // addRegion logic in AudioEngine might be different.
      // Actually AudioService logic was complex.
      // I should probably add track first.
      
      // However, current RegionController.addRegion does:
      // await this.audioEngine.addRegion(trackId, regionData);
      // And I don't see specific "create track" logic there.
      // So I should call addTrack first.
      
      await controller.track.addTrack(uploadedAudioFile.url, trackId);
      
      await controller.region.addRegion(trackId, {
        id: regionId,
        url: uploadedAudioFile.url,
        startTime: 0,
        sourceStartTime: 0,
        duration: duration,
        audioFile: { url: uploadedAudioFile.url, duration }
      });

      // Simple callback
      onAudioFileDrop?.(uploadedAudioFile);

      return uploadedAudioFile;
    },
    [addAudioFile, controller, onAudioFileDrop]
  );

  return (
    <BasicFileDrop
      onFileDrop={async file => {
        await onFileDrop(file);
      }}
    />
  );
};
