import * as styles from '../../DawPage.css.ts';
import { ExportButton } from '../ExportButton/ExportButton';
import { TempoMetadataControl } from './TempoMetadataControl';

interface DawHeaderProps {
  trackCount: number;
}

export function DawHeader({ trackCount }: DawHeaderProps) {
  return (
    <div className={styles.header}>
      <h1 className={styles.title}>Tracks</h1>
      <div className={styles.headerRight}>
        <TempoMetadataControl />
        <span className={styles.trackCount}>{trackCount} tracks</span>
        <ExportButton />
      </div>
    </div>
  );
}
