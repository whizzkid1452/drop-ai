import * as styles from '../FileUpload.css';
import type { AudioFile } from './types';

interface AudioPreviewProps {
  file: AudioFile;
}

export function AudioPreview({ file }: AudioPreviewProps) {
  return (
    <audio src={file.url} controls className={styles.audioPreview} />
  );
}

