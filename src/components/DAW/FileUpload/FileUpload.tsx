import { useState, useCallback, memo } from 'react';
import * as styles from './FileUpload.css';
import type { FileUploadProps } from '../../../types';

/**
 * 파일 업로드 컴포넌트
 * - 파일 선택
 * - 드래그 앤 드롭
 * - 트랙에 추가
 */
export const FileUpload = memo(function FileUpload({ onFileAdd }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 파일 처리
  const handleFile = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);

      // 오디오 파일만 필터링
      const audioFiles = fileArray.filter(file =>
        file.type.startsWith('audio/')
      );

      if (audioFiles.length === 0) {
        setError('오디오 파일만 업로드할 수 있습니다.');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        for (const file of audioFiles) {
          // File 객체를 AudioBuffer로 변환
          const arrayBuffer = await file.arrayBuffer();
          const audioBuffer = await new AudioContext().decodeAudioData(
            arrayBuffer
          );

          // 파일 이름과 함께 전달 (나중에 파일 메타데이터로 사용)
          onFileAdd(file, audioBuffer);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(`파일 로드 실패: ${errorMessage}`);
        console.error('파일 로드 오류:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [onFileAdd]
  );

  // 파일 선택 핸들러
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files) {
        handleFile(files);
      }
      // 같은 파일을 다시 선택할 수 있도록
      e.target.value = '';
    },
    [handleFile]
  );

  // 드래그 오버 핸들러
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  // 드래그 리브 핸들러
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  // 드롭 핸들러
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files);
      }
    },
    [handleFile]
  );

  return (
    <div className={styles.container}>
      <input
        type="file"
        id="file-upload"
        multiple
        accept="audio/*"
        onChange={handleFileSelect}
        className={styles.hiddenInput}
      />

      <label
        htmlFor="file-upload"
        className={`${styles.dropZone} ${isDragging ? styles.dragging : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isLoading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>파일 로드 중...</p>
          </div>
        ) : (
          <>
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className={styles.title}>
              {isDragging ? '여기에 파일을 놓으세요' : '파일 업로드'}
            </p>
            <p className={styles.description}>
              오디오 파일을 여기에 드래그하거나 클릭하여 선택
            </p>
            <p className={styles.supported}>
              지원 형식: MP3, WAV, OGG, M4A, AAC
            </p>
          </>
        )}
      </label>

      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
});
