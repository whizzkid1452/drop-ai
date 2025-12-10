import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as styles from './FileUpload.css';
import type { FileUploadProps } from './components/types';
import { useFileUpload } from './hooks/useFileUpload';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { DropHere } from './components/DropHere';
import { AudioPreview } from './components/AudioPreview';
import { ErrorMessage } from './components/ErrorMessage';

export function FileUpload({ onFileUploaded }: FileUploadProps) {
  const navigate = useNavigate();

  const { uploadedFile, error, isLoading, parseAudioFile } = useFileUpload({
    onFileUploaded,
  });

  const {
    isDragging,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop: handleDragDrop,
  } = useDragAndDrop({
    onDrop: parseAudioFile,
  });

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        parseAudioFile(files[0]);
      }
    },
    [parseAudioFile]
  );

  const handleNavigateToDaw = useCallback(() => {
    navigate('/daw');
  }, [navigate]);

  return (
    <div className={styles.container}>
      {!uploadedFile && (
        <DropHere
          isDragging={isDragging}
          isLoading={isLoading}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDragDrop}
          onFileSelect={handleFileSelect}
        />
      )}

      {error && <ErrorMessage message={error} />}

      {uploadedFile && (
        <>
          <AudioPreview file={uploadedFile} />
          <button
            onClick={handleNavigateToDaw}
            className={styles.editButton}
          >
            Edit Here!
          </button>
        </>
      )}
    </div>
  );
}

