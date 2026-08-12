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
import { useAudioSourceResolver, useCommandExecutor, useSession } from '@/layers/apps/web/context/layer-hooks';
import { executeTrackMuteChange, executeTrackSoloChange } from '@/layers/apps/web/hooks/track-mute-solo-commands';
import { pruneWaveformRenderCache, storeWaveformRenderData, type WaveformRenderCache } from './waveform-render-cache';
import { clampTimelinePixelsPerQuarterNote, TIMELINE_ZOOM_FACTOR } from '../../timeline-zoom';
import type { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';

interface TrackListProps {
  onTrackSelect: (trackId: string) => void;
  coordinateMapper: TimelineCoordinateMapper;
  selectedTrackId: string | null;
  setPixelsPerQuarterNote: (value: number) => void;
  timelineViewportRef: RefObject<HTMLDivElement | null>;
}

export function TrackList({
  onTrackSelect,
  coordinateMapper,
  selectedTrackId,
  setPixelsPerQuarterNote,
  timelineViewportRef,
}: TrackListProps) {
  const tracks = useSession(state => state.tracks);
  const trackArray = Array.from(tracks.values());
  const commandExecutor = useCommandExecutor();
  const audioSourceResolver = useAudioSourceResolver();

  const [wavesurferInstances, setWavesurferInstances] = useState<Map<string, WaveSurfer>>(new Map());
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();

        const newPixelsPerQuarterNote =
          e.deltaY > 0
            ? coordinateMapper.pixelsPerQuarterNote / TIMELINE_ZOOM_FACTOR
            : coordinateMapper.pixelsPerQuarterNote * TIMELINE_ZOOM_FACTOR;
        const clamped = clampTimelinePixelsPerQuarterNote(newPixelsPerQuarterNote);
        const scaleRatio = clamped / coordinateMapper.pixelsPerQuarterNote;

        setPixelsPerQuarterNote(clamped);

        wavesurferInstances.forEach(ws => {
          ws.zoom(coordinateMapper.pixelsPerSecond * scaleRatio);
        });
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [coordinateMapper, wavesurferInstances, setPixelsPerQuarterNote]);

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

  return (
    <div className={styles.trackList}>
      <div ref={containerRef} className={styles.tracksContainer}>
        <Cursor coordinateMapper={coordinateMapper} timelineViewportRef={timelineViewportRef} />
        {trackArray.map(track => (
          <TrackComponent
            key={track.id}
            track={track}
            isSelected={track.id === selectedTrackId}
            coordinateMapper={coordinateMapper}
            onReady={handleReady}
            onMuteChange={muted => handleMuteChange(track.id, muted)}
            onSelect={() => onTrackSelect(track.id)}
            onSoloChange={soloed => handleSoloChange(track.id, soloed)}
            waveformRenderCache={waveformRenderCacheRef.current}
          />
        ))}
      </div>
    </div>
  );
}
