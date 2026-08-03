import { useState } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { useCommandExecutor, useSession } from '@/layers/apps/web/context/layer-hooks';
import { executeConfirmedTrackRemoval } from '@/layers/apps/web/hooks/track-action-commands';
import { resolveSplitRegionId } from '@/layers/apps/web/hooks/resolve-split-region-id';
import { useTrackActions } from '@/layers/apps/web/hooks/useTrackActions';
import { AudioCommandType } from '@/types/audioCommand.schema';
import { LoopSlotControls } from '../Track/components/LoopSlotControls';
import { TrackPanController } from '../Track/components/TrackPanController';
import { TrackPluginControls } from '../Track/components/TrackPluginControls';
import { TrackRegionImportControl } from '../Track/components/TrackRegionImportControl';
import { TrackVolumeController } from '../Track/components/TrackVolumeController';
import * as styles from './TrackInfoSidebar.css.ts';

interface TrackInfoSidebarProps {
  selectedTrackId: string | null;
}

export function TrackInfoSidebar({ selectedTrackId }: TrackInfoSidebarProps) {
  const tracks = useSession(state => state.tracks);
  const currentTime = useSession(state => state.currentTime);
  const selectedTrack = selectedTrackId === null ? undefined : tracks.get(selectedTrackId);
  const commandExecutor = useCommandExecutor();
  const { splitRegion } = useTrackActions();
  const { showBoundary } = useErrorBoundary();
  const [isImportingRegion, setIsImportingRegion] = useState(false);
  const [isRemovingTrack, setIsRemovingTrack] = useState(false);

  if (!selectedTrack) {
    return (
      <div className={styles.container}>
        <div className={styles.titleBar}>INSPECTOR</div>
        <div className={styles.emptyMessage}>Track을 선택하세요.</div>
      </div>
    );
  }

  const splitRegionId = resolveSplitRegionId({ regions: selectedTrack.regions, splitTime: currentTime });

  const handleVolumeChange = async (volume: number) => {
    try {
      await commandExecutor.execute({
        type: AudioCommandType.SET_TRACK_VOLUME,
        trackId: selectedTrack.id,
        volume,
      });
    } catch (error) {
      showBoundary(error);
    }
  };

  const handlePanChange = async (pan: number) => {
    try {
      await commandExecutor.execute({
        type: AudioCommandType.SET_TRACK_PAN,
        trackId: selectedTrack.id,
        pan,
      });
    } catch (error) {
      showBoundary(error);
    }
  };

  const handleSplit = async () => {
    if (splitRegionId === null || isImportingRegion || isRemovingTrack) {
      return;
    }

    try {
      await splitRegion({
        trackId: selectedTrack.id,
        regionId: splitRegionId,
        splitTime: currentTime,
      });
    } catch (error) {
      showBoundary(error);
    }
  };

  const handleRemoveTrack = async () => {
    if (isImportingRegion || isRemovingTrack) {
      return;
    }

    setIsRemovingTrack(true);
    try {
      await executeConfirmedTrackRemoval({
        trackId: selectedTrack.id,
        confirmRemoval: () => window.confirm('이 Track과 포함된 모든 Region을 삭제할까요?'),
        executeCommand: command => commandExecutor.execute(command),
        notifyFailure: message => window.alert(message),
      });
    } finally {
      setIsRemovingTrack(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.titleBar}>
        <span>INSPECTOR</span>
        <span className={styles.trackName}>{selectedTrack.name}</span>
      </div>
      <div className={styles.contentArea}>
        <section className={styles.section} aria-labelledby="track-mix-title">
          <h2 id="track-mix-title" className={styles.sectionTitle}>
            MIX
          </h2>
          <div className={styles.mixControls}>
            <TrackVolumeController volume={selectedTrack.volume} onVolumeChange={handleVolumeChange} />
            <TrackPanController pan={selectedTrack.pan} onPanChange={handlePanChange} />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="track-actions-title">
          <h2 id="track-actions-title" className={styles.sectionTitle}>
            TRACK ACTIONS
          </h2>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.actionButton}
              aria-label="선택 Track Region 분할"
              disabled={splitRegionId === null || isImportingRegion || isRemovingTrack}
              onClick={() => void handleSplit()}
            >
              SPLIT
            </button>
            <TrackRegionImportControl
              key={selectedTrack.id}
              trackId={selectedTrack.id}
              disabled={isRemovingTrack}
              onPendingChange={setIsImportingRegion}
            />
            <button
              type="button"
              className={`${styles.actionButton} ${styles.dangerButton}`}
              aria-label="선택 Track 삭제"
              aria-busy={isRemovingTrack}
              disabled={isImportingRegion || isRemovingTrack}
              onClick={() => void handleRemoveTrack()}
            >
              {isRemovingTrack ? '…' : 'DELETE'}
            </button>
          </div>
        </section>

        <TrackPluginControls trackId={selectedTrack.id} pluginInstances={selectedTrack.pluginInstances} />

        {(selectedTrack.loopSlots?.length ?? 0) > 0 ? (
          <LoopSlotControls loopSlots={selectedTrack.loopSlots ?? []} trackId={selectedTrack.id} />
        ) : null}
      </div>
    </div>
  );
}
