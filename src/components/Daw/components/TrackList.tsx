import { useAudioCommand, handleAudioEngineError } from '@/logics/audio';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
// import { useTrackStore } from '@/stores/useTrackStore'; // Deprecated
import { useAudio } from '@/presentation/hooks/useAudio';
import { useEffect, useRef, useState } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import { useShallow } from 'zustand/react/shallow';
import { TrackComponent } from './Track/TrackComponent';
import * as styles from './TrackList.css';
import { Cursor } from './Cursor/Cursor';

export function TrackList() {
  const { tracks } = useAudio();
  // tracks is already an array from snapshot
  const trackArray = tracks || [];

  const [wavesurferInstances, setWavesurferInstances] = useState<
    Map<string, WaveSurfer>
  >(new Map());

  const { execute } = useAudioCommand();
  // Note: Manual AudioEngine initialization is now handled by useAudioSync
  const containerRef = useRef<HTMLDivElement>(null);
  const { pixelsPerSecond, setPixelsPerSecond } = usePlaybackStore(
    useShallow(state => ({
      pixelsPerSecond: state.pixelsPerSecond,
      setPixelsPerSecond: state.setPixelsPerSecond,
    }))
  );

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

        // Clamp
        const clamped = Math.max(1, Math.min(1000, newPixelsPerSecond));

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
  }, [pixelsPerSecond, setPixelsPerSecond, wavesurferInstances]);

  return (
    <div className={styles.trackList}>
      {/* @todo: 추후 디자인 수정 예정 */}
      <div ref={containerRef} className={styles.tracksContainer}>
        <Cursor />
        {(trackArray as any[]).map((track: any) => {
          const thisWs = wavesurferInstances.get(track.id);
          const thisMedia = thisWs?.getMediaElement();

          return (
            <TrackComponent
              key={track.id}
              track={track}
              mediaElement={thisMedia ?? null}
              pixelsPerSecond={pixelsPerSecond}
              onReady={ws => {
                // trackStore에 wavesurfer 인스턴스 저장
                setWavesurferInstances(prev => {
                  const newMap = new Map(prev);
                  newMap.set(track.id, ws);
                  return newMap;
                });
              }}
              onVolumeChange={async vol => {
                try {
                  await execute({
                    type: 'SET_TRACK_VOLUME',
                    trackId: track.id,
                    volume: vol,
                  });
                } catch (error) {
                  handleAudioEngineError(error);
                }
              }}
              onPanChange={async pan => {
                try {
                  await execute({
                    type: 'SET_TRACK_PAN',
                    trackId: track.id,
                    pan: pan,
                  });
                } catch (error) {
                  handleAudioEngineError(error);
                }
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
