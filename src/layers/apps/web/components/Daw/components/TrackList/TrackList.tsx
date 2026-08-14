import { useEffect, useRef, useState, useCallback } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import type { RefObject } from 'react';
import { TrackComponent, type RegionWaveSurferReadyEvent } from '../Track/TrackComponent';
import {
  createRegionWaveSurferKey,
  pruneWaveSurferInstances,
  registerWaveSurferInstance,
} from './prune-wave-surfer-instances';
import * as styles from './TrackList.css.ts';
import { Cursor } from '@/layers/apps/web/components/Cursor/Cursor';
import {
  useAudioSourceResolver,
  useCommandExecutor,
  useEditorRuntimeState,
  useSession,
} from '@/layers/apps/web/context/layer-hooks';
import { executeTrackMuteChange, executeTrackSoloChange } from '@/layers/apps/web/hooks/track-mute-solo-commands';
import { pruneWaveformRenderCache, storeWaveformRenderData, type WaveformRenderCache } from './waveform-render-cache';
import type { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';
import type { TimelineGridSettings } from '../../timeline-grid';
import { TimelineGrid } from '../TimelineGrid/TimelineGrid';
import { AudioCommandType } from '@/types/audioCommand.schema';

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
  const trackArray = Array.from(tracks.values());
  const commandExecutor = useCommandExecutor();
  const editorRuntime = useEditorRuntimeState();
  const audioSourceResolver = useAudioSourceResolver();

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
            isSelected={track.id === selectedTrackId}
            coordinateMapper={coordinateMapper}
            gridSettings={gridSettings}
            onReady={handleReady}
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
