import { useState, useCallback } from 'react';
import type { AudioFile } from '../components/types';
import { validateFile } from '../utils/fileValidation';
import { getFileDuration } from '../utils/audioMetadata';
import { formatFileSize } from '@/utils/formatFileSize';
import { formatDuration } from '@/utils/formatDuration';
// 상수 import
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
          file,           // 원본 File 객체
          name: file.name, // 파일명
          size: file.size, // 파일 크기
          formattedSize: formatFileSize(file.size), // 포맷팅된 파일 크기
          type: file.type, // MIME 타입
          duration,       // 재생 시간 (초)
          formattedDuration: duration ? formatDuration(duration) : undefined, // 포맷팅된 재생 시간
          url,            // Object URL (미리보기용)
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

