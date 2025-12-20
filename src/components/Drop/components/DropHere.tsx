import { useMemo } from 'react';
import { useDropzone, type Accept, type FileRejection } from 'react-dropzone';
import * as styles from '../DropPage.css';
import { ACCEPTED_AUDIO_TYPES, MAX_FILE_SIZE, MAX_FILE_SIZE_MB, UI_MESSAGES, ERROR_MESSAGES } from '../../Daw/components/FileUpload/components/constants';

interface DropHereProps {
  isLoading: boolean;
  onFileDrop: (file: File) => void;
  onError?: (error: string) => void;
}

export function DropHere({ isLoading, onFileDrop, onError }: DropHereProps) {
  const accept = useMemo<Accept>(
    () =>
      ACCEPTED_AUDIO_TYPES.reduce<Accept>((acc, type) => {
        acc[type] = [];
        return acc;
      }, {}),
    []
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept,
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    disabled: isLoading,
    onDropAccepted: (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        onFileDrop(file);
      }
    },
    onDropRejected: (fileRejections: FileRejection[]) => {
      const rejection = fileRejections[0];
      if (rejection) {
        const error = rejection.errors[0];
        // react-dropzone이 이미 에러 메시지를 제공하므로 직접 사용
        // 필요시 커스텀 메시지로 오버라이드
        if (error.code === 'file-too-large') {
          onError?.(ERROR_MESSAGES.FILE_TOO_LARGE(MAX_FILE_SIZE_MB));
        } else {
          onError?.(error.message || 'File upload failed.');
        }
      }
    },
  });

  return (
    <div
      {...getRootProps({
        className: `${styles.dropZone} ${isDragActive ? styles.dropZoneActive : ''}`,
      })}
    >
      <input {...getInputProps({ className: styles.fileInput })} />
      <div className={styles.dropZoneContent}>
        <h2 className={styles.title}>
          {isLoading ? UI_MESSAGES.TITLE_PROCESSING : UI_MESSAGES.TITLE_UPLOAD}
        </h2>
        <p className={styles.subtitle}>{UI_MESSAGES.SUBTITLE}</p>
        {isLoading && <div className={styles.loadingIndicator} />}
        {!isLoading && (
          <button
            type="button"
            className={styles.button}
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
          >
            {UI_MESSAGES.BUTTON_SELECT}
          </button>
        )}
      </div>
    </div>
  );
}


