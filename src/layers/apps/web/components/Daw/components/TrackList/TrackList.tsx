import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import { TrackComponent, type RegionWaveSurferReadyEvent } from '../Track/TrackComponent';
import type { AutomationWritePassDraft } from '../Track/AutomationLaneEditor';
import {
  createRegionWaveSurferKey,
  pruneWaveSurferInstances,
  registerWaveSurferInstance,
} from './prune-wave-surfer-instances';
import * as styles from './TrackList.css.ts';
import { Cursor } from '@/layers/apps/web/components/Cursor/Cursor';
import {
  useAudioRuntimeCapabilities,
  useAudioSourceResolver,
  useCommandExecutor,
  useEditorRuntimeState,
  usePlaybackClock,
  useSession,
} from '@/layers/apps/web/context/layer-hooks';
import { executeTrackMuteChange, executeTrackSoloChange } from '@/layers/apps/web/hooks/track-mute-solo-commands';
import { pruneWaveformRenderCache, storeWaveformRenderData, type WaveformRenderCache } from './waveform-render-cache';
import type { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';
import type { TimelineGridSettings } from '../../timeline-grid';
import { TimelineGrid } from '../TimelineGrid/TimelineGrid';
import { AudioCommandType } from '@/types/audioCommand.schema';
import type { AutomationLaneState } from '@/layers/shared/types/automation-state';
import { AudioRuntimeFeature } from '@/layers/shared/utils/audio-runtime-capabilities';

interface TrackListProps {
  onTrackSelect: (trackId: string) => void;
  coordinateMapper: TimelineCoordinateMapper;
  followPlayhead: boolean;
  gridSettings: TimelineGridSettings;
  isGridVisible: boolean;
  selectedTrackId: string | null;
  timelineContentWidth: number;
  timelineViewportRef: RefObject<HTMLDivElement | null>;
}

export function TrackList({
  onTrackSelect,
  coordinateMapper,
  followPlayhead,
  gridSettings,
  isGridVisible,
  selectedTrackId,
  timelineContentWidth,
  timelineViewportRef,
}: TrackListProps) {
  const tracks = useSession(state => state.tracks);
  const pluginCatalog = useSession(state => state.pluginCatalog);
  const routingGraph = useSession(state => state.routingGraph);
  const trackArray = useMemo(() => Array.from(tracks.values()), [tracks]);
  const commandExecutor = useCommandExecutor();
  const playbackClock = usePlaybackClock();
  const editorRuntime = useEditorRuntimeState();
  const audioSourceResolver = useAudioSourceResolver();
  const automationCapability = useAudioRuntimeCapabilities().features[AudioRuntimeFeature.AUTOMATION];
  const trackNamesById = useMemo(() => new Map(trackArray.map(track => [track.id, track.name])), [trackArray]);

  const [, setWavesurferInstances] = useState<Map<string, WaveSurfer>>(new Map());
  const waveformRenderCacheRef = useRef<WaveformRenderCache>(new Map());

  useEffect(() => {
    const activeRegionKeys = new Set(
      Array.from(tracks.values()).flatMap(track =>
        track.regions.map(region => createRegionWaveSurferKey({ trackId: track.id, regionId: region.id }))
      )
    );
    setWavesurferInstances(currentInstances =>
      pruneWaveSurferInstances({ instances: currentInstances, activeRegionKeys })
    );
    const activeSourceIds = new Set(
      Array.from(tracks.values()).flatMap(track => track.regions.map(region => region.sourceId))
    );
    pruneWaveformRenderCache({
      cache: waveformRenderCacheRef.current,
      activeSourceIds,
    });
  }, [tracks]);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleReady = useCallback(
    ({ trackId, regionId, sourceId, waveSurfer }: RegionWaveSurferReadyEvent) => {
      setWavesurferInstances(currentInstances =>
        registerWaveSurferInstance({
          instances: currentInstances,
          trackId,
          regionId,
          instance: waveSurfer,
        })
      );

      const source = audioSourceResolver.resolve(sourceId);
      if (!source || !source.regionIds.includes(regionId)) {
        return;
      }

      storeWaveformRenderData({
        cache: waveformRenderCacheRef.current,
        sourceId,
        objectUrl: source.objectUrl,
        waveSurfer,
      });
    },
    [audioSourceResolver]
  );

  const handleMuteChange = useCallback(
    async (trackId: string, muted: boolean) => {
      return executeTrackMuteChange({
        trackId,
        muted,
        executeCommand: command => commandExecutor.execute(command),
        notifyFailure: message => window.alert(message),
      });
    },
    [commandExecutor]
  );

  const handleSoloChange = useCallback(
    async (trackId: string, soloed: boolean) => {
      return executeTrackSoloChange({
        trackId,
        soloed,
        executeCommand: command => commandExecutor.execute(command),
        notifyFailure: message => window.alert(message),
      });
    },
    [commandExecutor]
  );

  const handleRegionSelect = useCallback(
    async (trackId: string, regionId: string, additive: boolean) => {
      const currentSelection = editorRuntime.selection;
      const selectedKey = `${trackId}\u0000${regionId}`;
      const currentSelections = additive ? [...currentSelection.regions] : [];
      const existingIndex = currentSelections.findIndex(
        selection => `${selection.trackId}\u0000${selection.regionId}` === selectedKey
      );
      if (existingIndex >= 0) {
        currentSelections.splice(existingIndex, 1);
      } else {
        currentSelections.push({ regionId, trackId });
      }
      try {
        await commandExecutor.execute({
          type: AudioCommandType.SET_EDITOR_SELECTION,
          editPointSeconds: currentSelection.editPointSeconds,
          range: currentSelection.range
            ? { ...currentSelection.range, trackIds: [...currentSelection.range.trackIds] }
            : null,
          regions: currentSelections,
          trackIds: [trackId],
        });
        onTrackSelect(trackId);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : String(error));
      }
    },
    [commandExecutor, editorRuntime.selection, onTrackSelect]
  );

  const handleTrimRegion = useCallback(
    async (
      trackId: string,
      regionId: string,
      request: { durationSeconds: number; sourceStartTimeSeconds: number; startTimeSeconds: number }
    ) => {
      await commandExecutor.execute({
        type: AudioCommandType.TRIM_REGION,
        durationSeconds: request.durationSeconds,
        regionId,
        sourceStartTimeSeconds: request.sourceStartTimeSeconds,
        startTimeSeconds: request.startTimeSeconds,
        trackId,
      });
    },
    [commandExecutor]
  );

  const handleFadeChange = useCallback(
    async (trackId: string, regionId: string, edge: 'in' | 'out', durationSeconds: number) => {
      const region = tracks.get(trackId)?.regions.find(candidate => candidate.id === regionId);
      if (!region) {
        return;
      }
      const fade = {
        curve: edge === 'in' ? region.fadeIn.curve : region.fadeOut.curve,
        durationSeconds,
      };
      await commandExecutor.execute({
        type: AudioCommandType.SET_REGION_PROCESSING,
        ...(edge === 'in' ? { fadeIn: fade } : { fadeOut: fade }),
        regionId,
        trackId,
      });
    },
    [commandExecutor, tracks]
  );

  const handleAutomationChange = useCallback(
    async (trackId: string, automationLanes: readonly AutomationLaneState[]) => {
      await commandExecutor.execute({
        automationLanes: automationLanes.map(lane => ({
          ...lane,
          points: lane.points.map(point => ({ ...point })),
          target: { ...lane.target },
        })),
        trackId,
        type: AudioCommandType.SET_AUTOMATION_LANES,
      });
    },
    [commandExecutor]
  );

  const handleAutomationWritePreview = useCallback(
    async (trackId: string, request: AutomationWritePassDraft) => {
      await commandExecutor.execute({
        ...request,
        samples: request.samples.map(sample => ({ ...sample })),
        trackId,
        type: AudioCommandType.PREVIEW_AUTOMATION_WRITE_PASS,
      });
    },
    [commandExecutor]
  );

  const handleAutomationWriteCommit = useCallback(
    async (trackId: string, request: AutomationWritePassDraft) => {
      await commandExecutor.execute({
        ...request,
        samples: request.samples.map(sample => ({ ...sample })),
        trackId,
        type: AudioCommandType.COMMIT_AUTOMATION_WRITE_PASS,
      });
    },
    [commandExecutor]
  );

  const handleAutomationWriteCancel = useCallback(
    async (trackId: string, laneId: string) => {
      await commandExecutor.execute({
        laneId,
        trackId,
        type: AudioCommandType.CANCEL_AUTOMATION_WRITE_PREVIEW,
      });
    },
    [commandExecutor]
  );

  const handleRangeSelect = useCallback(
    async (trackId: string, startTimeSeconds: number, endTimeSeconds: number) => {
      try {
        await commandExecutor.execute({
          type: AudioCommandType.SET_EDITOR_SELECTION,
          editPointSeconds: startTimeSeconds,
          range: { endTimeSeconds, startTimeSeconds, trackIds: [trackId] },
          regions: [],
          trackIds: [trackId],
        });
        onTrackSelect(trackId);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : String(error));
      }
    },
    [commandExecutor, onTrackSelect]
  );

  return (
    <div className={styles.trackList}>
      <div ref={containerRef} className={styles.tracksContainer}>
        <TimelineGrid
          coordinateMapper={coordinateMapper}
          division={gridSettings.division}
          isVisible={isGridVisible}
          timelineContentWidth={timelineContentWidth}
        />
        <Cursor
          coordinateMapper={coordinateMapper}
          followPlayhead={followPlayhead}
          timelineViewportRef={timelineViewportRef}
        />
        {trackArray.map(track => (
          <TrackComponent
            key={track.id}
            track={track}
            automationCapability={automationCapability}
            isSelected={track.id === selectedTrackId}
            coordinateMapper={coordinateMapper}
            editPointSeconds={editorRuntime.selection.editPointSeconds}
            gridSettings={gridSettings}
            pluginCatalog={pluginCatalog}
            routingGraph={routingGraph}
            trackNamesById={trackNamesById}
            getAutomationTime={() => playbackClock.getCurrentTime()}
            onAutomationChange={automationLanes => handleAutomationChange(track.id, automationLanes)}
            onAutomationWriteCancel={laneId => handleAutomationWriteCancel(track.id, laneId)}
            onAutomationWriteCommit={request => handleAutomationWriteCommit(track.id, request)}
            onAutomationWritePreview={request => handleAutomationWritePreview(track.id, request)}
            onReady={handleReady}
            onFadeChange={(regionId, edge, durationSeconds) =>
              handleFadeChange(track.id, regionId, edge, durationSeconds)
            }
            onMuteChange={muted => handleMuteChange(track.id, muted)}
            onSelect={() => onTrackSelect(track.id)}
            onSoloChange={soloed => handleSoloChange(track.id, soloed)}
            onRegionSelect={(regionId, additive) => void handleRegionSelect(track.id, regionId, additive)}
            onRangeSelect={(startTimeSeconds, endTimeSeconds) =>
              void handleRangeSelect(track.id, startTimeSeconds, endTimeSeconds)
            }
            onTrimRegion={(regionId, request) => handleTrimRegion(track.id, regionId, request)}
            selectedRegionIds={
              new Set(
                editorRuntime.selection.regions
                  .filter(selection => selection.trackId === track.id)
                  .map(selection => selection.regionId)
              )
            }
            selectedRange={
              editorRuntime.selection.range?.trackIds.includes(track.id)
                ? {
                    endTimeSeconds: editorRuntime.selection.range.endTimeSeconds,
                    startTimeSeconds: editorRuntime.selection.range.startTimeSeconds,
                  }
                : null
            }
            waveformRenderCache={waveformRenderCacheRef.current}
          />
        ))}
      </div>
    </div>
  );
}
