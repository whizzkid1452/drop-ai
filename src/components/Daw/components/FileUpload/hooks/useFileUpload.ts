import { useState, useCallback, useRef } from 'react';
import type { AudioFile } from '../components/types';
import { getFileDuration } from '@/logics/audio/audioUtils';
import { formatFileSize, formatDuration } from '@/components/Daw/utils/UIformatter';
import { ERROR_MESSAGES } from '../components/constants';

interface UseFileUploadOptions {
  onFileUploaded?: (file: AudioFile) => void;
}

export function useFileUpload({ onFileUploaded }: UseFileUploadOptions = {}) {
  const [uploadedFile, setUploadedFile] = useState<AudioFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const uploadedFileRef = useRef<AudioFile | null>(null);

  const parseAudioFile = useCallback(
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
        setUploadedFile(audioFile);
        onFileUploaded?.(audioFile);
      } catch (err) {
        setError(ERROR_MESSAGES.PROCESSING_ERROR);
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    },
    [onFileUploaded]
  );

  const reset = useCallback(() => {
    uploadedFileRef.current?.dispose?.();
    uploadedFileRef.current = null;
    setUploadedFile(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    uploadedFile,
    error,
    isLoading,
    parseAudioFile,
    reset,
    setError,
  };
}
