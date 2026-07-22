import type { AudioFile } from '@/types/audioFile';
import { convertFileToAudioFile } from '@/utils/audio/convert-file-to-audio-file';
import { useAudioSourceStager, useCommandExecutor } from '@/layers/apps/web/context/layer-hooks';
import { stageWebAudioSource } from '@/layers/apps/web/hooks/stage-web-audio-source';
import { useCallback } from 'react';
import { BasicFileDrop } from './BasicFileDrop';
import { executeAudioFileImport } from './execute-audio-file-import';

interface AudioFileDropProps {
  onAudioFileDrop?: (audioFile: AudioFile | null) => Promise<void> | void;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function reportFileDropFailure(message: string, error: unknown): void {
  console.error(error);
  window.alert(`${message}: ${getErrorMessage(error)}`);
}

export const AudioFileDrop = ({ onAudioFileDrop }: AudioFileDropProps) => {
  const commandExecutor = useCommandExecutor();
  const audioSourceStager = useAudioSourceStager();

  const onFileDrop = useCallback(
    async (file: File) => {
      let audioFileMetadata;
      try {
        audioFileMetadata = await convertFileToAudioFile(file);
      } catch (error) {
        reportFileDropFailure('오디오 파일을 읽지 못했습니다', error);
        return null;
      }

      if (audioFileMetadata == null) {
        try {
          await onAudioFileDrop?.(null);
        } catch (error) {
          reportFileDropFailure('파일 오류 상태를 화면에 반영하지 못했습니다', error);
        }
        return null;
      }

      const trackId = crypto.randomUUID();
      const regionId = crypto.randomUUID();
      let uploadedAudioFile: AudioFile;
      try {
        const stagedSource = stageWebAudioSource({ audioSourceStager, audioFileMetadata });
        uploadedAudioFile = await executeAudioFileImport({
          commandExecutor,
          audioSourceStager,
          stagedSource,
          trackId,
          regionId,
        });
      } catch (error) {
        reportFileDropFailure('오디오 파일을 가져오지 못했습니다', error);
        return null;
      }

      try {
        await onAudioFileDrop?.(uploadedAudioFile);
      } catch (error) {
        reportFileDropFailure('오디오 파일 가져오기는 완료됐지만 화면을 갱신하지 못했습니다', error);
      }

      return uploadedAudioFile;
    },
    [audioSourceStager, commandExecutor, onAudioFileDrop]
  );

  return (
    <BasicFileDrop
      onFileDrop={async file => {
        await onFileDrop(file);
      }}
    />
  );
};
