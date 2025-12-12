import * as styles from './FileUpload.css';
import type { FileUploadProps } from './components/types';
import { useFileUpload } from './hooks/useFileUpload';
import { DropHere } from './components/DropHere';
import { AudioPreview } from './components/AudioPreview';
import { ErrorMessage } from './components/ErrorMessage';

export function FileUpload({ onFileUploaded, onEdit, autoReset = false }: FileUploadProps) {
  const { uploadedFile, error, isLoading, parseAudioFile, reset, setError } = useFileUpload({
    onFileUploaded: (file) => {
      onFileUploaded?.(file);
    },
  });

  const handleEditHere = () => {
    if (!uploadedFile) return;
    onEdit?.(uploadedFile);
    if (autoReset) {
      reset();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <h1 className={styles.heroTitle}>Drop.ai</h1>
        <div className={styles.heroAccent} />
        <p className={styles.heroSubtitle}>Browser-based audio editing tool</p>
      </div>

      {!uploadedFile && (
        <DropHere
          isLoading={isLoading}
          onFileDrop={parseAudioFile}
          onError={setError}
        />
      )}

      {error && <ErrorMessage message={error} />}

      {uploadedFile && (
        <>
          <AudioPreview file={uploadedFile} />
          <button
            onClick={handleEditHere}
            className={styles.editButton}
          >
            Edit Here!
          </button>
        </>
      )}
    </div>
  );
}


