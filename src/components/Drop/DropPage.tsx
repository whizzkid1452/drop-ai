import { useCallback, useState } from 'react';
import type { AudioFile } from '../Daw/components/FileUpload/components/types';
import { useFileUpload } from '../Daw/components/FileUpload/hooks/useFileUpload';
import { DropHere } from './components/DropHere';
import { ErrorMessage } from './components/ErrorMessage';
import * as styles from './DropPage.css';
import { AudioPreview } from './components/AudioPreview';

export function DropPage() {
  const { error, isLoading, addAudioFile, setError } = useFileUpload();
  const [uploadedFile, setUploadedFile] = useState<null | AudioFile>(null);
  const onFileDrop = useCallback(async (file: File) => {
    const audioFile = await addAudioFile(file);
    setUploadedFile(audioFile);
  }, []);

  

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
          onFileDrop={onFileDrop}
          onError={setError}
        />
      )}

      {error && <ErrorMessage message={error} />}

       {uploadedFile && (
        <>
          <AudioPreview file={uploadedFile} />
          <button  className={styles.editButton}>
            Edit Here!
          </button>
        </>
      )}
    </div>
  );
}
