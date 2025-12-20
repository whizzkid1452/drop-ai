import * as styles from '../DropPage.css';
import type { AudioFile } from '../../Daw/components/FileUpload/components/types';

interface AudioPreviewProps {
  file: AudioFile;
}

export function AudioPreview({ file }: AudioPreviewProps) {
  return (
    <audio src={file.url} controls className={styles.audioPreview} />
  );
}


