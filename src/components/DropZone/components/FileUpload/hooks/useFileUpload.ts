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

  const parseAudioFile = useCallback(
    async (file: File) => {
      setIsLoading(true);
      setError(null);

      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        setIsLoading(false);
        return;
      }

      /* @note whizzkid 추후 스토리지 저장 필요 */
      // validation 통과 후에만 기존 파일 정리
      uploadedFile?.dispose?.();

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
          // Object URL 정리 함수를 track에 포함시켜 추상화
          // 중복 호출 방지 및 에러 처리 포함
          dispose: (() => {
            let disposed = false;
            return () => {
              if (disposed) return;
              disposed = true;
              try {
                URL.revokeObjectURL(url);
              } catch (err) {
                console.warn('Failed to revoke Object URL:', err);
              }
            };
          })(),
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

  const reset = useCallback(() => {
    // 추상화된 cleanup 메서드를 통해 리소스 정리
    uploadedFile?.dispose?.();
    setUploadedFile(null);
    setError(null);
    setIsLoading(false);
  }, [uploadedFile]);

  return {
    uploadedFile,
    error,
    isLoading,
    parseAudioFile,
    reset,
  };
}

