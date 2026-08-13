import * as styles from '../../DawPage.css.ts';
import { ExportButton } from '../ExportButton/ExportButton';
import { LoadProjectControl } from '../LoadProjectControl/LoadProjectControl';
import { SaveProjectButton } from '../SaveProjectButton/SaveProjectButton';
import { UndoRedoControls } from '../UndoRedoControls/UndoRedoControls';
import { PlaybackControls } from '../PlaybackControls/PlaybackControls';
import { AudioRuntimeStatus } from './AudioRuntimeStatus';
import { MasterVolumeControl } from './MasterVolumeControl';
import { LoopMetronomeControl } from './LoopMetronomeControl';
import { TempoMetadataControl } from './TempoMetadataControl';
import { AddTrackControl } from '../AddTrackControl/AddTrackControl';
import { MidiLoopControl } from './MidiLoopControl';
import { AccountControl } from '@/layers/apps/web/components/Auth/AccountControl';
import type { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';
import { MusicalPositionClock } from './MusicalPositionClock';
import { InputDeviceControl } from '../LiveInputControls/InputDeviceControl';
import { RecordingControl } from './RecordingControl';
import { RegionEditControls } from './RegionEditControls';

interface DawHeaderProps {
  trackCount: number;
  coordinateMapper: TimelineCoordinateMapper;
}

export function DawHeader({ coordinateMapper, trackCount }: DawHeaderProps) {
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
          <AccountControl />
        </div>
      </div>
      <div className={styles.transportBar}>
        <div className={styles.runtimeSection}>
          <AudioRuntimeStatus />
        </div>
        <div className={styles.transportSection} aria-label="Transport">
          <MusicalPositionClock coordinateMapper={coordinateMapper} />
          <PlaybackControls layout="inline" />
          <RecordingControl />
        </div>
        <div className={styles.statusSection}>
          <LoopMetronomeControl />
          <InputDeviceControl />
          <MasterVolumeControl />
          <TempoMetadataControl />
          <span className={styles.trackCount}>{trackCount} tracks</span>
        </div>
      </div>
      <div className={styles.editorBar}>
        <RegionEditControls />
      </div>
    </header>
  );
}
