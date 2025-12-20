import { useState, useCallback, useRef } from 'react';
import type { AudioFile } from '../components/types';
import { getFileDuration } from '../utils/audioMetadata';
import { formatFileSize } from '@/components/Daw/utils/formatFileSize';
import { formatDuration } from '@/components/Daw/utils/formatDuration';
import { ERROR_MESSAGES } from '../components/constants';

interface UseFileUploadOptions {
  onFileUploaded?: (file: AudioFile) => void;
}

export function useFileUpload({ onFileUploaded }: UseFileUploadOptions = {}) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const uploadedFileRef = useRef<AudioFile | null>(null);

  const addAudioFile = useCallback(
    async (file: File) => {
      setIsLoading(true);
      setError(null);

      /* @note whizzkid 추후 스토리지 저장 필요 */
      // react-dropzone에서 이미 검증 완료된 파일이므로 바로 처리
      uploadedFileRef.current?.dispose?.();

      try {
        const url = URL.createObjectURL(file);
        let duration: number | undefined;

        try {
          duration = await getFileDuration(file);
        } catch (err) {
          console.warn('Unable to get file duration:', err);
        }

        const audioFile: AudioFile = {
          file,
          name: file.name,
          size: file.size,
          formattedSize: formatFileSize(file.size),
          type: file.type,
          duration,
          formattedDuration: duration ? formatDuration(duration) : undefined,
          url,
          volume: 1.0, // 기본 볼륨 레벨
        };

        uploadedFileRef.current = audioFile;
        onFileUploaded?.(audioFile);
        return audioFile;
      } catch (err) {
        setError(ERROR_MESSAGES.PROCESSING_ERROR);
        console.error(err);
        return null
      } finally {
        setIsLoading(false);
      }
    },
    [onFileUploaded]
  );

  return {
    error,
    isLoading,
    addAudioFile,
    setError,
  };
}
