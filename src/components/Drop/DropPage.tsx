import { useCallback, useState } from 'react';
import { NavLink } from 'react-router-dom';
import type { AudioFile } from '../../types/audioFile';
import { AudioFileDrop } from '../common/FileDrop/AudioFileDrop';
import * as styles from './DropPage.css';

export function DropPage() {
  const [uploadedFile, setUploadedFile] = useState<null | AudioFile>(null);

  const onAudioFileDrop = useCallback((audioFile: AudioFile | null) => {
    if (audioFile == null) {
      return;
    }
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
          <audio
            src={uploadedFile.url}
            controls
            className={styles.audioPreview}
          />
          <NavLink to="/daw" className={styles.editButton}>
            Go to track
          </NavLink>
        </>
      ) : (
        <AudioFileDrop onAudioFileDrop={onAudioFileDrop} />
      )}
    </div>
  );
}
