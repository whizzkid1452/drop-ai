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
import { clampTimelinePixelsPerSecond, TIMELINE_ZOOM_FACTOR } from '../../timeline-zoom';

interface TrackListProps {
  onTrackSelect: (trackId: string) => void;
  pixelsPerSecond: number;
  selectedTrackId: string | null;
  setPixelsPerSecond: (value: number) => void;
  timelineViewportRef: RefObject<HTMLDivElement | null>;
}

export function TrackList({
  onTrackSelect,
  pixelsPerSecond,
  selectedTrackId,
  setPixelsPerSecond,
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

        const newPixelsPerSecond =
          e.deltaY > 0 ? pixelsPerSecond / TIMELINE_ZOOM_FACTOR : pixelsPerSecond * TIMELINE_ZOOM_FACTOR;
        const clamped = clampTimelinePixelsPerSecond(newPixelsPerSecond);

        setPixelsPerSecond(clamped);

        wavesurferInstances.forEach(ws => {
          ws.zoom(clamped);
        });
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [pixelsPerSecond, wavesurferInstances, setPixelsPerSecond]);

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
        <Cursor pixelsPerSecond={pixelsPerSecond} timelineViewportRef={timelineViewportRef} />
        {trackArray.map(track => (
          <TrackComponent
            key={track.id}
            track={track}
            isSelected={track.id === selectedTrackId}
            pixelsPerSecond={pixelsPerSecond}
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
