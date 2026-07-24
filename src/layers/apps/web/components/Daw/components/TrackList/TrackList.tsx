import { useEffect, useRef, useState, useCallback } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import { useErrorBoundary } from 'react-error-boundary';
import { TrackComponent, type RegionWaveSurferReadyEvent } from '../Track/TrackComponent';
import {
  createRegionWaveSurferKey,
  pruneWaveSurferInstances,
  registerWaveSurferInstance,
} from './prune-wave-surfer-instances';
import * as styles from './TrackList.css.ts';
import { Cursor } from '@/layers/apps/web/components/Cursor/Cursor';
import { useAudioSourceResolver, useCommandExecutor, useSession } from '@/layers/apps/web/context/layer-hooks';
import { executeConfirmedTrackRemoval } from '@/layers/apps/web/hooks/track-action-commands';
import { executeTrackMuteChange, executeTrackSoloChange } from '@/layers/apps/web/hooks/track-mute-solo-commands';
import { AudioCommandType } from '@/types/audioCommand.schema';
import { pruneWaveformRenderCache, storeWaveformRenderData, type WaveformRenderCache } from './waveform-render-cache';
import { clampTimelinePixelsPerSecond, TIMELINE_ZOOM_FACTOR } from '../../timeline-zoom';

interface TrackListProps {
  pixelsPerSecond: number;
  setPixelsPerSecond: (value: number) => void;
}

export function TrackList({ pixelsPerSecond, setPixelsPerSecond }: TrackListProps) {
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

  const { showBoundary } = useErrorBoundary();
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

        // ?뵩 Update to PlaybackStore
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

  const handleVolumeChange = useCallback(
    async (trackId: string, vol: number) => {
      try {
        await commandExecutor.execute({
          type: AudioCommandType.SET_TRACK_VOLUME,
          trackId,
          volume: vol,
        });
      } catch (error) {
        showBoundary(error);
      }
    },
    [commandExecutor, showBoundary]
  );

  const handlePanChange = useCallback(
    async (trackId: string, pan: number) => {
      try {
        await commandExecutor.execute({
          type: AudioCommandType.SET_TRACK_PAN,
          trackId,
          pan,
        });
      } catch (error) {
        showBoundary(error);
      }
    },
    [commandExecutor, showBoundary]
  );

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

  const handleRemoveTrack = useCallback(
    async (trackId: string) => {
      return executeConfirmedTrackRemoval({
        trackId,
        confirmRemoval: () => window.confirm('이 Track과 포함된 모든 Region을 삭제할까요?'),
        executeCommand: command => commandExecutor.execute(command),
        notifyFailure: message => window.alert(message),
      });
    },
    [commandExecutor]
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
      {/* @todo: 異뷀썑 ?붿옄???섏젙 ?덉젙 */}
      <div ref={containerRef} className={styles.tracksContainer}>
        <Cursor pixelsPerSecond={pixelsPerSecond} />
        {trackArray.map(track => {
          const thisWs = track.regions
            .map(region =>
              wavesurferInstances.get(createRegionWaveSurferKey({ trackId: track.id, regionId: region.id }))
            )
            .find(instance => instance !== undefined);
          const thisMedia = thisWs?.getMediaElement();

          return (
            <TrackComponent
              key={track.id}
              track={track}
              mediaElement={thisMedia ?? null}
              pixelsPerSecond={pixelsPerSecond}
              onReady={handleReady}
              onVolumeChange={handleVolumeChange}
              onPanChange={handlePanChange}
              onMuteChange={muted => handleMuteChange(track.id, muted)}
              onSoloChange={soloed => handleSoloChange(track.id, soloed)}
              onRemoveTrack={() => handleRemoveTrack(track.id)}
              waveformRenderCache={waveformRenderCacheRef.current}
            />
          );
        })}
      </div>
    </div>
  );
}
