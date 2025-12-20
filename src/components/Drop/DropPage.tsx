import { useCallback, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useLoading } from 'react-simplikit';
import { convertFileToAudioFile } from '../../logics/audio/convertFileToAudioFile';
import type { AudioFile } from '../Daw/components/FileUpload/components/types';
import { AudioPreview } from './components/AudioPreview';
import { DropHere } from './components/DropHere';
import { ErrorMessage } from './components/ErrorMessage';
import * as styles from './DropPage.css';

export function DropPage() {
  const [uploadedFile, setUploadedFile] = useState<null | AudioFile>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoading] = useLoading();

  const onFileDrop = useCallback(async (file: File) => {
    const result = await startLoading(convertFileToAudioFile(file));
    if (result == null) {
      // @todo(@steinjun0): 추후 throw error + error boundary로 변경
      setError('Failed to convert file to audio file');
      return;
    }
    setUploadedFile(result.audioFile);
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <h1 className={styles.heroTitle}>Drop.ai</h1>
        <div className={styles.heroAccent} />
        <p className={styles.heroSubtitle}>Browser-based audio editing tool</p>
      </div>

      {uploadedFile ? (
        <>
          <AudioPreview file={uploadedFile} />
          <NavLink to="/daw" className={styles.editButton}>
            Go to track
          </NavLink>
        </>
      ) : (
        <DropHere
          isLoading={isLoading}
          onFileDrop={onFileDrop}
          onError={setError}
        />
      )}

      {error ? <ErrorMessage message={error} /> : null}
    </div>
  );
}
