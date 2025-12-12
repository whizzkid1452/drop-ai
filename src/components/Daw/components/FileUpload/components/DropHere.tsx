import { useMemo } from 'react';
import { useDropzone, type Accept } from 'react-dropzone';
import * as styles from '../FileUpload.css';
import { ACCEPTED_AUDIO_TYPES, UI_MESSAGES } from './constants';

interface DropHereProps {
  isLoading: boolean;
  onFileDrop: (file: File) => void;
}

export function DropHere({ isLoading, onFileDrop }: DropHereProps) {
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
    multiple: false,
    disabled: isLoading,
    onDrop: (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        onFileDrop(file);
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

