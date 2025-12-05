// React 훅 import
import { useCallback } from 'react';
// 스타일 import
import * as styles from './FileUpload.css';
// 타입 import
import type { FileUploadProps } from './components/types';
// 커스텀 훅 import
import { useAudioFileUpload } from './hooks/useAudioFileUpload';
import { useDragAndDrop } from './hooks/useDragAndDrop';
// 컴포넌트 import
import { DropHere } from './components/DropHere';
import { AudioPreview } from './components/AudioPreview';
import { ErrorMessage } from './components/ErrorMessage';
import { LargeFileConfirmDialog } from './components/LargeFileConfirmDialog';

/**
 * 음원 파일 업로드 컴포넌트
 * 드래그 앤 드롭과 파일 선택 다이얼로그를 지원합니다.
 * 
 * @param onFileUploaded - 파일 업로드 완료 시 호출되는 콜백 함수
 */
export function FileUpload({ onFileUploaded }: FileUploadProps) {
  // 파일 업로드 관련 상태와 함수들
  const {
    uploadedFile,
    error,
    isLoading,
    processFile,
    isLargeFileDialogOpen,
    setIsLargeFileDialogOpen,
    pendingFileSize,
    onLargeFileConfirm,
    onLargeFileCancel,
  } = useAudioFileUpload({
    onFileUploaded,
  });

  // 드래그 앤 드롭 관련 상태와 이벤트 핸들러
  const {
    isDragging,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop: handleDragDrop,
  } = useDragAndDrop({
    onDrop: processFile,
  });

  /**
   * 파일 선택 다이얼로그에서 파일을 선택했을 때 호출되는 핸들러
   */
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
    },
    [processFile]
  );

  return (
    <div className={styles.container}>
      {/* 드래그 앤 드롭 영역 */}
      <DropHere
        isDragging={isDragging}
        isLoading={isLoading}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDragDrop}
        onFileSelect={handleFileSelect}
      />

      {/* 에러 메시지 표시 */}
      {error && <ErrorMessage message={error} />}

      {/* 오디오 미리보기 플레이어 */}
      {uploadedFile && <AudioPreview file={uploadedFile} />}

      {/* 큰 파일 확인 다이얼로그 */}
      <LargeFileConfirmDialog
        open={isLargeFileDialogOpen}
        onOpenChange={setIsLargeFileDialogOpen}
        fileSize={pendingFileSize}
        onConfirm={onLargeFileConfirm}
        onCancel={onLargeFileCancel}
      />
    </div>
  );
}

