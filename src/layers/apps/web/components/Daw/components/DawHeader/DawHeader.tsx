import * as styles from '../../DawPage.css.ts';
import { ExportButton } from '../ExportButton/ExportButton';
import { LoadProjectControl } from '../LoadProjectControl/LoadProjectControl';
import { SaveProjectButton } from '../SaveProjectButton/SaveProjectButton';
import { UndoRedoControls } from '../UndoRedoControls/UndoRedoControls';
import { PlaybackControls } from '../PlaybackControls/PlaybackControls';
import { AudioRuntimeStatus } from './AudioRuntimeStatus';
import { MasterVolumeControl } from './MasterVolumeControl';
import { TempoMetadataControl } from './TempoMetadataControl';
import { AddTrackControl } from '../AddTrackControl/AddTrackControl';
import { MidiLoopControl } from './MidiLoopControl';

interface DawHeaderProps {
  trackCount: number;
}

export function DawHeader({ trackCount }: DawHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.projectBar}>
        <div className={styles.headerIdentity}>
          <span className={styles.productName}>DROP.AI</span>
          <span className={styles.workspaceName}>EDITOR</span>
        </div>
        <div className={styles.projectActions}>
          <AddTrackControl />
          <MidiLoopControl />
          <UndoRedoControls />
          <LoadProjectControl />
          <SaveProjectButton />
          <ExportButton />
        </div>
      </div>
      <div className={styles.transportBar}>
        <div className={styles.runtimeSection}>
          <AudioRuntimeStatus />
        </div>
        <div className={styles.transportSection} aria-label="Transport">
          <PlaybackControls layout="inline" />
        </div>
        <div className={styles.statusSection}>
          <MasterVolumeControl />
          <TempoMetadataControl />
          <span className={styles.trackCount}>{trackCount} tracks</span>
        </div>
      </div>
    </header>
  );
}
