import { useMemo } from 'react';
import { useDropzone, type Accept, type FileRejection } from 'react-dropzone';
import * as styles from './FileDrop.css';

import { useLoading } from 'react-simplikit';
import {
  ACCEPTED_AUDIO_TYPES,
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_MB,
} from './constants/audioConstants';

interface BasicFileDropProps {
  onFileDrop: (file: File) => Promise<void>;
  onError?: (rejections: FileRejection[]) => void;
}

export function BasicFileDrop({ onFileDrop, onError }: BasicFileDropProps) {
  const [isLoading, startLoading] = useLoading();
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
        startLoading(onFileDrop(file));
      }
    },
    onDropRejected: (fileRejections: FileRejection[]) => {
      const rejection = fileRejections[0];
      if (rejection) {
        const error = rejection.errors[0];
        // react-dropzone이 이미 에러 메시지를 제공하므로 직접 사용
        // 필요시 커스텀 메시지로 오버라이드
        if (error.code === 'file-too-large') {
          alert(`File size is too big. Max file size:${MAX_FILE_SIZE_MB}MB`);
        } else {
          alert(`File upload failed. ${error.code}: ${error.message}`);
        }
      }
      onError?.(fileRejections);
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
          {isLoading ? 'Processing...' : 'Upload Audio File'}
        </h2>
        <p className={styles.subtitle}>
          Drop an audio file here, or click to select one
        </p>
        {isLoading && <div className={styles.loadingIndicator} />}
        {!isLoading && (
          <button
            type="button"
            className={styles.button}
            onClick={e => {
              e.stopPropagation();
              open();
            }}
          >
            Select File
          </button>
        )}
      </div>
    </div>
  );
}
