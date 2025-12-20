import { useCallback, useState } from 'react';
import type { AudioFile } from '../Daw/components/FileUpload/components/types';
import { convertFileToAudioFile } from '../../logics/audio/convertFileToAudioFile';
import { AudioPreview } from './components/AudioPreview';
import { DropHere } from './components/DropHere';
import { ErrorMessage } from './components/ErrorMessage';
import * as styles from './DropPage.css';
import { useLoading } from 'react-simplikit';
import { NavLink } from 'react-router-dom';

export function DropPage() {
  const [uploadedFile, setUploadedFile] = useState<null | AudioFile>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoading] = useLoading();

  const onFileDrop = useCallback(async (file: File) => {
    const audioFile = await startLoading(convertFileToAudioFile(file));
    setUploadedFile(audioFile);
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
