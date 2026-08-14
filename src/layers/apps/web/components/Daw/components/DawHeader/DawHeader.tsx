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
import { SessionLifecycleControl } from '../SessionLifecycleControl/SessionLifecycleControl';

interface DawHeaderProps {
  trackCount: number;
  coordinateMapper: TimelineCoordinateMapper;
  currentView: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
}

export type WorkspaceView = 'editor' | 'mixer' | 'media';

export function DawHeader({ coordinateMapper, currentView, onViewChange, trackCount }: DawHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.projectBar}>
        <div className={styles.headerIdentity}>
          <span className={styles.productName}>DROP.AI</span>
          <span className={styles.workspaceName}>{currentView.toUpperCase()}</span>
        </div>
        <nav aria-label="Workspace view" className={styles.workspaceViewTabs}>
          <button
            aria-label="Open Editor"
            aria-pressed={currentView === 'editor'}
            className={`${styles.workspaceViewButton} ${currentView === 'editor' ? styles.workspaceViewButtonActive : ''}`}
            onClick={() => onViewChange('editor')}
            type="button"
          >
            EDITOR
          </button>
          <button
            aria-label="Open Mixer"
            aria-pressed={currentView === 'mixer'}
            className={`${styles.workspaceViewButton} ${currentView === 'mixer' ? styles.workspaceViewButtonActive : ''}`}
            onClick={() => onViewChange('mixer')}
            type="button"
          >
            MIXER
          </button>
          <button
            aria-label="Open Media"
            aria-pressed={currentView === 'media'}
            className={`${styles.workspaceViewButton} ${currentView === 'media' ? styles.workspaceViewButtonActive : ''}`}
            onClick={() => onViewChange('media')}
            type="button"
          >
            MEDIA
          </button>
        </nav>
        <div className={styles.projectActions}>
          <AddTrackControl />
          <MidiLoopControl />
          <UndoRedoControls />
          <LoadProjectControl />
          <SaveProjectButton />
          <SessionLifecycleControl />
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
      {currentView === 'editor' ? (
        <div className={styles.editorBar}>
          <RegionEditControls />
        </div>
      ) : null}
    </header>
  );
}
