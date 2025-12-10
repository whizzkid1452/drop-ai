import { useState, useCallback } from 'react';
import type { AudioFile } from '../components/types';
import { validateFile } from '../utils/fileValidation';
import { getFileDuration } from '../utils/audioMetadata';
import { ERROR_MESSAGES } from '../components/constants';

interface UseFileUploadOptions {
  onFileUploaded?: (file: AudioFile) => void;
}

export function useFileUpload({ onFileUploaded }: UseFileUploadOptions = {}) {
  const [uploadedFile, setUploadedFile] = useState<AudioFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const processFile = useCallback(
    async (file: File) => {
      setIsLoading(true);
      setError(null);

      if (uploadedFile?.url) {
        URL.revokeObjectURL(uploadedFile.url);
      }

      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        setIsLoading(false);
        return;
      }

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
          type: file.type,
          duration,
          url,
        };

        setUploadedFile(audioFile);
        onFileUploaded?.(audioFile);
      } catch (err) {
        setError(ERROR_MESSAGES.PROCESSING_ERROR);
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    },
    [onFileUploaded, uploadedFile]
  );

  return {
    uploadedFile,
    error,
    isLoading,
    processFile,
  };
}

