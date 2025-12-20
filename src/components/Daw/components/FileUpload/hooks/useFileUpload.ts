import { formatDuration } from '@/components/Daw/utils/formatDuration';
import { formatFileSize } from '@/components/Daw/utils/formatFileSize';
import { useCallback, useState } from 'react';
import { ERROR_MESSAGES } from '../components/constants';
import type { AudioFile } from '../components/types';
import { getFileDuration } from '../utils/audioMetadata';

interface UseFileUploadOptions {
  onFileUploaded?: (file: AudioFile) => void;
}

export function useFileUpload({ onFileUploaded }: UseFileUploadOptions = {}) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const addAudioFile = useCallback(
    async (file: File) => {
      setIsLoading(true);
      setError(null);


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
