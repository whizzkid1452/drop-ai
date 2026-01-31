import { useAudioCommand } from '@/logics/audio';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import { useAudioService } from '@/presentation/hooks/useAudioService';
import { useEffect, useRef, useState, useCallback } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import { useErrorBoundary } from 'react-error-boundary';
import { TrackComponent } from './Track/TrackComponent';
import * as styles from './TrackList.css';
import { Cursor } from './Cursor/Cursor';
import { useShallow } from 'zustand/react/shallow';

export function TrackList() {
  const tracks = useAudioService(state => state.tracks);
  const trackArray = tracks || [];

  const [wavesurferInstances, setWavesurferInstances] = useState<
    Map<string, WaveSurfer>
  >(new Map());

  const { execute } = useAudioCommand();
  const { showBoundary } = useErrorBoundary();
  const containerRef = useRef<HTMLDivElement>(null);

  // 🔧 Use Selector to prevent re-renders when other state changes
  const { pixelsPerSecond, setPixelsPerSecond } = usePlaybackStore(
    useShallow(state => ({
      pixelsPerSecond: state.pixelsPerSecond,
      setPixelsPerSecond: state.setPixelsPerSecond,
    }))
  );

  // Calculate Max Duration from tracks (same logic as TimeRuler mostly)
  const maxDuration = trackArray.reduce((acc, track) => {
    let trackMax = 0;
    track.regions.forEach(r => {
      const end = r.startTime + (r.audioFile?.duration ?? r.duration ?? 0);
      if (end > trackMax) trackMax = end;
    });
    return Math.max(acc, trackMax);
  }, 0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();

        const zoomFactor = 1.1;
        const newPixelsPerSecond =
          e.deltaY > 0
            ? pixelsPerSecond / zoomFactor
            : pixelsPerSecond * zoomFactor;

        const effectiveDuration = Math.max(maxDuration, 30);
        const viewportWidth = container.clientWidth;
        const minPps = viewportWidth / effectiveDuration;
        const clamped = Math.max(minPps, Math.min(1000, newPixelsPerSecond));

        // 🔧 Update to PlaybackStore
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
  }, [pixelsPerSecond, wavesurferInstances, setPixelsPerSecond, maxDuration]);

  const handleVolumeChange = useCallback(
    async (trackId: string, vol: number) => {
      try {
        await execute({
          type: 'SET_TRACK_VOLUME',
          trackId: trackId,
          volume: vol,
        });
      } catch (error) {
        showBoundary(error);
      }
    },
    [execute, showBoundary]
  );

  const handlePanChange = useCallback(
    async (trackId: string, pan: number) => {
      try {
        await execute({
          type: 'SET_TRACK_PAN',
          trackId: trackId,
          pan: pan,
        });
      } catch (error) {
        showBoundary(error);
      }
    },
    [execute, showBoundary]
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
      {/* @todo: 추후 디자인 수정 예정 */}
      <div ref={containerRef} className={styles.tracksContainer}>
        <Cursor />
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
