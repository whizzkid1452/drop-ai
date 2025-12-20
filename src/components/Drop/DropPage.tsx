import { useCallback, useState } from 'react';
import type { AudioFile } from '../Daw/components/FileUpload/components/types';
import { convertFileToAudioFile } from '../../logics/audio/convertFileToAudioFile';
import { AudioPreview } from './components/AudioPreview';
import { DropHere } from './components/DropHere';
import { ErrorMessage } from './components/ErrorMessage';
import * as styles from './DropPage.css';

export function DropPage() {
  const [uploadedFile, setUploadedFile] = useState<null | AudioFile>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onFileDrop = useCallback(async (file: File) => {
    setIsLoading(true);
    const audioFile = await convertFileToAudioFile(file);
    setIsLoading(false);
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
          <button className={styles.editButton}>Edit Here!</button>
        </>
      )}
    </div>
  );
}
