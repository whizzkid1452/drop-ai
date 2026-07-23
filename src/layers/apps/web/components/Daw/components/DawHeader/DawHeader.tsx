import * as styles from '../../DawPage.css.ts';
import { ExportButton } from '../ExportButton/ExportButton';
import { LoadProjectControl } from '../LoadProjectControl/LoadProjectControl';
import { SaveProjectButton } from '../SaveProjectButton/SaveProjectButton';
import { UndoRedoControls } from '../UndoRedoControls/UndoRedoControls';
import { AudioRuntimeStatus } from './AudioRuntimeStatus';
import { MasterVolumeControl } from './MasterVolumeControl';
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
        <MasterVolumeControl />
        <TempoMetadataControl />
        <span className={styles.trackCount}>{trackCount} tracks</span>
        <UndoRedoControls />
        <LoadProjectControl />
        <SaveProjectButton />
        <ExportButton />
      </div>
    </div>
  );
}
