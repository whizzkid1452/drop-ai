import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as styles from './FileUpload.css';
import type { FileUploadProps } from './components/types';
import { useFileUpload } from './hooks/useFileUpload';
import { DropHere } from './components/DropHere';
import { AudioPreview } from './components/AudioPreview';
import { ErrorMessage } from './components/ErrorMessage';

export function FileUpload({ onFileUploaded, autoReset = false }: FileUploadProps) {
  const navigate = useNavigate();

  const { uploadedFile, error, isLoading, parseAudioFile, reset } = useFileUpload({
    onFileUploaded: (file) => {
      onFileUploaded?.(file);
      if (autoReset) {
        // autoReset이 true이면 업로드 후 상태 초기화
        setTimeout(() => reset(), 100);
      }
    },
  });

  const handleNavigateToDaw = useCallback(() => {
    navigate('/daw');
  }, [navigate]);

  return (
    <div className={styles.container}>
      {!uploadedFile && (
        <DropHere
          isLoading={isLoading}
          onFileDrop={parseAudioFile}
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


