import * as styles from '../../DawPage.css.ts';
import { ExportButton } from '../ExportButton/ExportButton';
import { SaveProjectButton } from '../SaveProjectButton/SaveProjectButton';
import { AudioRuntimeStatus } from './AudioRuntimeStatus';
import { TempoMetadataControl } from './TempoMetadataControl';

interface DawHeaderProps {
  trackCount: number;
}

export function DawHeader({ trackCount }: DawHeaderProps) {
  return (
    <div className={styles.header}>
      <h1 className={styles.title}>Tracks</h1>
      <div className={styles.headerRight}>
        <AudioRuntimeStatus />
        <TempoMetadataControl />
        <span className={styles.trackCount}>{trackCount} tracks</span>
        <SaveProjectButton />
        <ExportButton />
      </div>
    </div>
  );
}
