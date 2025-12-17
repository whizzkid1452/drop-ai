import { ExportButton } from '../ExportButton/ExportButton';
import type { AudioFile } from '../FileUpload/components/types';
import * as styles from './DawHeader.css';

interface DawHeaderProps {
  trackCount: number;
  tracks: AudioFile[];
}

export function DawHeader({ trackCount, tracks }: DawHeaderProps) {
  return (
    <div className={styles.header}>
      <h1 className={styles.title}>트랙 목록</h1>
      <div className={styles.headerRight}>
        <span className={styles.trackCount}>{trackCount}개 트랙</span>
        <ExportButton tracks={tracks} />
      </div>
    </div>
  );
}
