import { useEffect, useRef, useState, useCallback } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import { useErrorBoundary } from 'react-error-boundary';
import { TrackComponent } from '../Track/TrackComponent';
import * as styles from './TrackList.css.ts';
import { Cursor } from '@/layers/apps/web/components/Cursor/Cursor';
import { useCommandExecutor, useSession } from '@/layers/apps/web/context/LayerContext';
import { AudioCommandType } from '@/types/audioCommand.schema';

interface TrackListProps {
  pixelsPerSecond: number;
  setPixelsPerSecond: (value: number) => void;
}

export function TrackList({ pixelsPerSecond, setPixelsPerSecond }: TrackListProps) {
  const tracks = useSession(state => state.tracks);
  const trackArray = Array.from(tracks.values());
  const commandExecutor = useCommandExecutor();

  const [wavesurferInstances, setWavesurferInstances] = useState<Map<string, WaveSurfer>>(new Map());

  const { showBoundary } = useErrorBoundary();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();

        const zoomFactor = 1.1;
        const newPixelsPerSecond = e.deltaY > 0 ? pixelsPerSecond / zoomFactor : pixelsPerSecond * zoomFactor;

        // Clamp
        const clamped = Math.max(1, Math.min(1000, newPixelsPerSecond));

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

  const handleReady = useCallback((trackId: string, ws: WaveSurfer) => {
    setWavesurferInstances(prev => {
      const newMap = new Map(prev);
      newMap.set(trackId, ws);
      return newMap;
    });
  }, []);

  return (
    <div className={styles.trackList}>
      {/* @todo: 異뷀썑 ?붿옄???섏젙 ?덉젙 */}
      <div ref={containerRef} className={styles.tracksContainer}>
        <Cursor pixelsPerSecond={pixelsPerSecond} />
        {trackArray.map(track => {
          const thisWs = wavesurferInstances.get(track.id);
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
            />
          );
        })}
      </div>
    </div>
  );
}
