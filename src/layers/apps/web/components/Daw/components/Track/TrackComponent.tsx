import type WaveSurfer from 'wavesurfer.js';
import { memo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { TrackToggleResult } from '@/layers/apps/web/hooks/track-mute-solo-commands';
import type { TrackState } from '@/layers/session/session';
import { useTrackActions } from '@/layers/apps/web/hooks/useTrackActions';
import { TrackNameControl } from './components/TrackNameControl';
import { RegionComponent } from './RegionComponent';
import * as styles from './Track.css.ts';
import type { WaveformRenderData } from '@/layers/apps/web/components/Daw/components/TrackList/waveform-render-cache';
import type { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';
import { snapTimelineSeconds, type TimelineGridSettings } from '../../timeline-grid';
import { AudioLevelMeter } from '../AudioLevelMeter/AudioLevelMeter';
import { TrackInputMonitoringControl } from '../LiveInputControls/TrackInputMonitoringControl';
import { TrackRecordArmControl } from './components/TrackRecordArmControl';
import { AutomationLaneEditor, type AutomationWritePassDraft } from './AutomationLaneEditor';
import type { AutomationLaneState } from '@/layers/shared/types/automation-state';
import type { PluginCatalogEntry } from '@/layers/shared/types/plugin-state';
import type { RoutingGraphSnapshot } from '@/layers/shared/types/routing-state';
import type { AudioRuntimeFeatureCapability } from '@/layers/shared/utils/audio-runtime-capabilities';
import { describeAudioRuntimeFeatureCapability } from '@/layers/apps/web/utils/audio-runtime-capability-labels';

export interface RegionWaveSurferReadyEvent {
  trackId: string;
  regionId: string;
  sourceId: string;
  waveSurfer: WaveSurfer;
}

export const TrackComponent = memo(function TrackComponent({
  isSelected,
  track,
  automationCapability,
  coordinateMapper,
  editPointSeconds,
  gridSettings,
  pluginCatalog,
  routingGraph,
  trackNamesById,
  onAutomationChange,
  getAutomationTime,
  onAutomationWriteCancel,
  onAutomationWriteCommit,
  onAutomationWritePreview,
  onReady,
  onFadeChange,
  onMuteChange,
  onSelect,
  onSoloChange,
  onRegionSelect,
  onRangeSelect,
  onTrimRegion,
  selectedRegionIds,
  selectedRange,
  waveformRenderCache,
}: {
  isSelected: boolean;
  track: TrackState;
  automationCapability: AudioRuntimeFeatureCapability;
  coordinateMapper: TimelineCoordinateMapper;
  editPointSeconds: number;
  gridSettings: TimelineGridSettings;
  pluginCatalog: ReadonlyMap<string, PluginCatalogEntry>;
  routingGraph: RoutingGraphSnapshot;
  trackNamesById: ReadonlyMap<string, string>;
  onAutomationChange: (automationLanes: readonly AutomationLaneState[]) => Promise<void>;
  getAutomationTime: () => number;
  onAutomationWriteCancel: (laneId: string) => Promise<void>;
  onAutomationWriteCommit: (request: AutomationWritePassDraft) => Promise<void>;
  onAutomationWritePreview: (request: AutomationWritePassDraft) => Promise<void>;
  onReady: (event: RegionWaveSurferReadyEvent) => void;
  onFadeChange: (regionId: string, edge: 'in' | 'out', durationSeconds: number) => Promise<void>;
  onMuteChange: (muted: boolean) => Promise<TrackToggleResult>;
  onSelect: () => void;
  onSoloChange: (soloed: boolean) => Promise<TrackToggleResult>;
  onRegionSelect: (regionId: string, additive: boolean) => void;
  onRangeSelect: (startTimeSeconds: number, endTimeSeconds: number) => void;
  onTrimRegion: (
    regionId: string,
    request: { durationSeconds: number; sourceStartTimeSeconds: number; startTimeSeconds: number }
  ) => Promise<void>;
  selectedRegionIds: ReadonlySet<string>;
  selectedRange: { endTimeSeconds: number; startTimeSeconds: number } | null;
  waveformRenderCache: ReadonlyMap<string, WaveformRenderData>;
}) {
  const { moveRegion, removeRegion } = useTrackActions();
  const [isMutePending, setIsMutePending] = useState(false);
  const [isSoloPending, setIsSoloPending] = useState(false);
  const [isAutomationOpen, setIsAutomationOpen] = useState(false);
  const rangePointerId = useRef<number | null>(null);
  const rangeStartTime = useRef(0);
  const [rangePreview, setRangePreview] = useState<{ endTimeSeconds: number; startTimeSeconds: number } | null>(null);

  const handleRemoveRegion = (regionId: string) => {
    void removeRegion({ trackId: track.id, regionId });
  };

  const handleMoveRegion = async (regionId: string, newStartTime: number) => {
    await moveRegion({ trackId: track.id, regionId, newStartTime });
  };

  const handleMuteChange = async () => {
    if (isMutePending) {
      return;
    }

    setIsMutePending(true);
    try {
      await onMuteChange(!track.isMuted);
    } finally {
      setIsMutePending(false);
    }
  };

  const handleSoloChange = async () => {
    if (isSoloPending) {
      return;
    }

    setIsSoloPending(true);
    try {
      await onSoloChange(!track.isSoloed);
    } finally {
      setIsSoloPending(false);
    }
  };

  const resolveTimelineTime = (event: ReactPointerEvent<HTMLDivElement>) => {
    const timelinePixel = Math.max(0, event.clientX - event.currentTarget.getBoundingClientRect().left);
    return snapTimelineSeconds({
      coordinateMapper,
      division: gridSettings.division,
      mode: gridSettings.snapMode,
      seconds: coordinateMapper.pixelsToSeconds(timelinePixel),
    });
  };

  const handleRangePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      event.target !== event.currentTarget ||
      !event.isPrimary ||
      event.button !== 0 ||
      rangePointerId.current !== null
    ) {
      return;
    }
    const startTimeSeconds = resolveTimelineTime(event);
    rangePointerId.current = event.pointerId;
    rangeStartTime.current = startTimeSeconds;
    event.currentTarget.setPointerCapture(event.pointerId);
    setRangePreview({ endTimeSeconds: startTimeSeconds, startTimeSeconds });
  };

  const handleRangePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (rangePointerId.current !== event.pointerId) {
      return;
    }
    const currentTimeSeconds = resolveTimelineTime(event);
    setRangePreview({
      endTimeSeconds: Math.max(rangeStartTime.current, currentTimeSeconds),
      startTimeSeconds: Math.min(rangeStartTime.current, currentTimeSeconds),
    });
  };

  const handleRangePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (rangePointerId.current !== event.pointerId) {
      return;
    }
    const currentTimeSeconds = resolveTimelineTime(event);
    const startTimeSeconds = Math.min(rangeStartTime.current, currentTimeSeconds);
    const endTimeSeconds = Math.max(rangeStartTime.current, currentTimeSeconds);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    rangePointerId.current = null;
    setRangePreview(null);
    if (endTimeSeconds > startTimeSeconds) {
      onRangeSelect(startTimeSeconds, endTimeSeconds);
    }
  };

  const handleRangePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (rangePointerId.current !== event.pointerId) {
      return;
    }
    rangePointerId.current = null;
    setRangePreview(null);
  };

  const displayedRange = rangePreview ?? selectedRange;
  const isAutomationAvailable = automationCapability.status === 'available';

  return (
    <article
      className={styles.trackRow}
      aria-label={`Track ${track.name}`}
      data-selected={isSelected}
      onFocus={onSelect}
      onMouseDownCapture={onSelect}
      tabIndex={0}
    >
      <div className={`${styles.trackHeader} ${isSelected ? styles.trackHeaderSelected : ''}`}>
        <TrackNameControl trackId={track.id} name={track.name} />
        <div className={styles.actionControls}>
          <TrackRecordArmControl trackId={track.id} trackName={track.name} />
          <button
            type="button"
            className={`${styles.trackActionButton} ${track.isMuted ? styles.muteButtonActive : ''}`}
            aria-label="Track Mute"
            aria-pressed={track.isMuted}
            disabled={isMutePending}
            onClick={() => void handleMuteChange()}
            title="Mute"
          >
            M
          </button>
          <button
            type="button"
            className={`${styles.trackActionButton} ${track.isSoloed ? styles.soloButtonActive : ''}`}
            aria-label="Track Solo"
            aria-pressed={track.isSoloed}
            disabled={isSoloPending}
            onClick={() => void handleSoloChange()}
            title="Solo"
          >
            S
          </button>
          <TrackInputMonitoringControl trackId={track.id} trackName={track.name} />
          <button
            type="button"
            className={`${styles.trackActionButton} ${isAutomationOpen ? styles.automationButtonActive : ''}`}
            aria-label={`${track.name} Automation Lane 표시`}
            aria-pressed={isAutomationOpen}
            disabled={!isAutomationAvailable}
            onClick={() => setIsAutomationOpen(isOpen => !isOpen)}
            title={isAutomationAvailable ? 'Automation' : describeAudioRuntimeFeatureCapability(automationCapability)}
          >
            A
          </button>
        </div>
        <AudioLevelMeter label="Track" target={{ kind: 'track', trackId: track.id }} />
      </div>
      <div
        className={styles.trackTimeline}
        aria-label={`${track.name} timeline`}
        onPointerCancel={handleRangePointerCancel}
        onPointerDown={handleRangePointerDown}
        onPointerMove={handleRangePointerMove}
        onPointerUp={handleRangePointerUp}
      >
        {displayedRange ? (
          <div
            className={styles.rangeSelection}
            data-testid={rangePreview ? 'range-selection-preview' : 'range-selection'}
            style={{
              left: coordinateMapper.secondsToPixels(displayedRange.startTimeSeconds),
              width: coordinateMapper.durationToPixels({
                durationSeconds: displayedRange.endTimeSeconds - displayedRange.startTimeSeconds,
                startSeconds: displayedRange.startTimeSeconds,
              }),
            }}
          />
        ) : null}
        {track.regions.map(region => (
          <RegionComponent
            key={region.id}
            region={region}
            coordinateMapper={coordinateMapper}
            gridSettings={gridSettings}
            onReady={waveSurfer =>
              onReady({
                trackId: track.id,
                regionId: region.id,
                sourceId: region.sourceId,
                waveSurfer,
              })
            }
            onMove={newStartTime => handleMoveRegion(region.id, newStartTime)}
            onFadeChange={(edge, durationSeconds) => onFadeChange(region.id, edge, durationSeconds)}
            onRemove={() => handleRemoveRegion(region.id)}
            onSelect={additive => onRegionSelect(region.id, additive)}
            onTrim={request => onTrimRegion(region.id, request)}
            selected={selectedRegionIds.has(region.id)}
            waveformRenderData={waveformRenderCache.get(region.sourceId)}
          />
        ))}
      </div>
      {isAutomationOpen ? (
        <AutomationLaneEditor
          coordinateMapper={coordinateMapper}
          editPointSeconds={editPointSeconds}
          getCurrentTime={getAutomationTime}
          onChange={onAutomationChange}
          onWriteCancel={onAutomationWriteCancel}
          onWriteCommit={onAutomationWriteCommit}
          onWritePreview={onAutomationWritePreview}
          pluginCatalog={pluginCatalog}
          routingGraph={routingGraph}
          selectedRange={selectedRange}
          track={track}
          trackNamesById={trackNamesById}
        />
      ) : null}
    </article>
  );
});
