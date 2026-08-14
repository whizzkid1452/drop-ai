import WavesurferPlayer from '@wavesurfer/react';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import * as styles from './RegionComponent.css.ts';
import type { IAudioSourceResolver } from '@/layers/audio-source-registry/i-audio-source-registry';
import { useAudioSourceResolver } from '@/layers/apps/web/context/layer-hooks';
import type { RegionState } from '@/layers/session/session';
import { calculateRegionDragStartTime } from '@/layers/apps/web/hooks/calculate-region-drag-start-time';
import type { WaveformRenderData } from '../TrackList/waveform-render-cache';
import type { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';
import { snapTimelineSeconds, type TimelineGridSettings } from '../../timeline-grid';

const MISSING_AUDIO_SOURCE_MESSAGE = '오디오 소스를 찾을 수 없습니다.';
// Region의 상·하 1px 테두리를 제외해야 WaveSurfer 캔버스가 76px Track 안에서 잘리지 않는다.
const TRACK_WAVEFORM_HEIGHT = 74;
const MIN_REGION_DURATION_SECONDS = 0.001;

interface RegionDragSession {
  pointerId: number;
  initialPointerX: number;
  initialStartTime: number;
}

interface RegionTrimSession extends RegionDragSession {
  edge: 'end' | 'start';
}

interface RegionTrimPreview {
  durationSeconds: number;
  sourceStartTimeSeconds: number;
  startTimeSeconds: number;
}

interface RegionFadeSession {
  edge: 'in' | 'out';
  initialDurationSeconds: number;
  initialPointerX: number;
  pointerId: number;
}

interface WaveformRenderSelection {
  objectUrl: string | null;
  renderData: WaveformRenderData | null;
}

interface RegionComponentProps {
  region: RegionState;
  coordinateMapper: TimelineCoordinateMapper;
  gridSettings: TimelineGridSettings;
  onReady?: (ws: WaveSurfer) => void;
  onFadeChange?: (edge: 'in' | 'out', durationSeconds: number) => Promise<void>;
  onMove?: (newStartTime: number) => Promise<void>;
  onRemove?: () => void;
  onSelect?: (additive: boolean) => void;
  onTrim?: (request: RegionTrimPreview) => Promise<void>;
  selected?: boolean;
  waveformRenderData?: WaveformRenderData;
}

function resolveRegionAudioSourceUrl(region: RegionState, audioSourceResolver: IAudioSourceResolver): string | null {
  const audioSource = audioSourceResolver.resolve(region.sourceId);
  if (!audioSource || !audioSource.regionIds.includes(region.id)) {
    return null;
  }

  return audioSource.objectUrl;
}

export const RegionComponent = ({
  region,
  coordinateMapper,
  gridSettings,
  onReady: onReadyProp,
  onFadeChange,
  onMove,
  onRemove,
  onSelect,
  onTrim,
  selected = false,
  waveformRenderData,
}: RegionComponentProps) => {
  const audioSourceResolver = useAudioSourceResolver();
  const dragSession = useRef<RegionDragSession | null>(null);
  const fadeSession = useRef<RegionFadeSession | null>(null);
  const trimSession = useRef<RegionTrimSession | null>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fadePreview, setFadePreview] = useState<{ durationSeconds: number; edge: 'in' | 'out' } | null>(null);
  const [previewStartTime, setPreviewStartTime] = useState<number | null>(null);
  const [trimPreview, setTrimPreview] = useState<RegionTrimPreview | null>(null);
  const displayedStartTime = trimPreview?.startTimeSeconds ?? previewStartTime ?? region.startTime;
  const displayedDuration = trimPreview?.durationSeconds ?? region.duration;
  const displayedFadeInDuration =
    fadePreview?.edge === 'in' ? fadePreview.durationSeconds : region.fadeIn.durationSeconds;
  const displayedFadeOutDuration =
    fadePreview?.edge === 'out' ? fadePreview.durationSeconds : region.fadeOut.durationSeconds;
  const left = coordinateMapper.secondsToPixels(displayedStartTime);
  const width = coordinateMapper.durationToPixels({
    startSeconds: displayedStartTime,
    durationSeconds: displayedDuration,
  });
  const audioSourceUrl = resolveRegionAudioSourceUrl(region, audioSourceResolver);
  const waveformRenderSelection = useRef<WaveformRenderSelection>({
    objectUrl: audioSourceUrl,
    renderData: waveformRenderData?.objectUrl === audioSourceUrl ? waveformRenderData : null,
  });
  if (waveformRenderSelection.current.objectUrl !== audioSourceUrl) {
    waveformRenderSelection.current = {
      objectUrl: audioSourceUrl,
      renderData: waveformRenderData?.objectUrl === audioSourceUrl ? waveformRenderData : null,
    };
  }

  useEffect(() => {
    waveSurferRef.current?.zoom(coordinateMapper.pixelsPerSecond);
  }, [coordinateMapper]);

  const calculateStartTime = (pointerX: number, session: RegionDragSession) => {
    const rawStartTime = calculateRegionDragStartTime({
      initialStartTime: session.initialStartTime,
      initialPointerX: session.initialPointerX,
      currentPointerX: pointerX,
      coordinateMapper,
    });
    return snapTimelineSeconds({
      coordinateMapper,
      division: gridSettings.division,
      mode: gridSettings.snapMode,
      seconds: rawStartTime,
    });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0 || !onMove || dragSession.current || previewStartTime !== null) {
      return;
    }

    onSelect?.(event.ctrlKey || event.metaKey || event.shiftKey);
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragSession.current = {
      pointerId: event.pointerId,
      initialPointerX: event.clientX,
      initialStartTime: region.startTime,
    };
    setIsDragging(true);
    setPreviewStartTime(region.startTime);
  };

  const calculateTrimPreview = (pointerX: number, session: RegionTrimSession): RegionTrimPreview => {
    const pointerDelta = pointerX - session.initialPointerX;
    if (session.edge === 'start') {
      const earliestStartTime = Math.max(0, region.startTime - region.sourceStartTime);
      const latestStartTime = region.endTime - MIN_REGION_DURATION_SECONDS;
      const rawStartTime = coordinateMapper.pixelsToSeconds(
        Math.max(0, coordinateMapper.secondsToPixels(region.startTime) + pointerDelta)
      );
      const snappedStartTime = snapTimelineSeconds({
        coordinateMapper,
        division: gridSettings.division,
        mode: gridSettings.snapMode,
        seconds: rawStartTime,
      });
      const startTimeSeconds = Math.min(latestStartTime, Math.max(earliestStartTime, snappedStartTime));
      const trimDeltaSeconds = startTimeSeconds - region.startTime;
      return {
        durationSeconds: region.duration - trimDeltaSeconds,
        sourceStartTimeSeconds: region.sourceStartTime + trimDeltaSeconds,
        startTimeSeconds,
      };
    }

    const rawEndTime = coordinateMapper.pixelsToSeconds(
      Math.max(0, coordinateMapper.secondsToPixels(region.endTime) + pointerDelta)
    );
    const snappedEndTime = snapTimelineSeconds({
      coordinateMapper,
      division: gridSettings.division,
      mode: gridSettings.snapMode,
      seconds: rawEndTime,
    });
    return {
      durationSeconds: Math.max(MIN_REGION_DURATION_SECONDS, snappedEndTime - region.startTime),
      sourceStartTimeSeconds: region.sourceStartTime,
      startTimeSeconds: region.startTime,
    };
  };

  const handleTrimPointerDown = (edge: RegionTrimSession['edge'], event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0 || !onTrim || trimSession.current) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onSelect?.(event.ctrlKey || event.metaKey || event.shiftKey);
    event.currentTarget.setPointerCapture(event.pointerId);
    trimSession.current = {
      edge,
      initialPointerX: event.clientX,
      initialStartTime: region.startTime,
      pointerId: event.pointerId,
    };
    setTrimPreview({
      durationSeconds: region.duration,
      sourceStartTimeSeconds: region.sourceStartTime,
      startTimeSeconds: region.startTime,
    });
  };

  const handleTrimPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const session = trimSession.current;
    if (!session || session.pointerId !== event.pointerId) {
      return;
    }
    setTrimPreview(calculateTrimPreview(event.clientX, session));
  };

  const handleTrimPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const session = trimSession.current;
    if (!session || session.pointerId !== event.pointerId || !onTrim) {
      return;
    }
    const request = calculateTrimPreview(event.clientX, session);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    trimSession.current = null;
    setTrimPreview(request);
    void onTrim(request).then(
      () => setTrimPreview(null),
      () => setTrimPreview(null)
    );
  };

  const handleTrimPointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const session = trimSession.current;
    if (!session || session.pointerId !== event.pointerId) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    trimSession.current = null;
    setTrimPreview(null);
  };

  const calculateFadeDuration = (pointerX: number, session: RegionFadeSession): number => {
    const regionEndTime = region.startTime + region.duration;
    const initialHandleTime =
      session.edge === 'in'
        ? region.startTime + session.initialDurationSeconds
        : regionEndTime - session.initialDurationSeconds;
    const handlePixels = Math.max(
      0,
      coordinateMapper.secondsToPixels(initialHandleTime) + pointerX - session.initialPointerX
    );
    const handleTime = coordinateMapper.pixelsToSeconds(handlePixels);
    const rawDuration = session.edge === 'in' ? handleTime - region.startTime : regionEndTime - handleTime;
    return Math.min(region.duration, Math.max(0, rawDuration));
  };

  const handleFadePointerDown = (edge: RegionFadeSession['edge'], event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0 || !onFadeChange || fadeSession.current) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onSelect?.(false);
    event.currentTarget.setPointerCapture(event.pointerId);
    const initialDurationSeconds = edge === 'in' ? region.fadeIn.durationSeconds : region.fadeOut.durationSeconds;
    fadeSession.current = { edge, initialDurationSeconds, initialPointerX: event.clientX, pointerId: event.pointerId };
    setFadePreview({ durationSeconds: initialDurationSeconds, edge });
  };

  const handleFadePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const session = fadeSession.current;
    if (!session || session.pointerId !== event.pointerId) {
      return;
    }
    event.stopPropagation();
    setFadePreview({ durationSeconds: calculateFadeDuration(event.clientX, session), edge: session.edge });
  };

  const handleFadePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const session = fadeSession.current;
    if (!session || session.pointerId !== event.pointerId || !onFadeChange) {
      return;
    }
    event.stopPropagation();
    const durationSeconds = calculateFadeDuration(event.clientX, session);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    fadeSession.current = null;
    setFadePreview({ durationSeconds, edge: session.edge });
    void onFadeChange(session.edge, durationSeconds).then(
      () => setFadePreview(null),
      () => setFadePreview(null)
    );
  };

  const handleFadePointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const session = fadeSession.current;
    if (!session || session.pointerId !== event.pointerId) {
      return;
    }
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    fadeSession.current = null;
    setFadePreview(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.key === 'Enter' || event.key === ' ') && onSelect) {
      event.preventDefault();
      onSelect(event.ctrlKey || event.metaKey || event.shiftKey);
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = dragSession.current;
    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    setPreviewStartTime(calculateStartTime(event.clientX, session));
  };

  const resetDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragSession.current = null;
    setIsDragging(false);
    setPreviewStartTime(null);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = dragSession.current;
    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    const newStartTime = calculateStartTime(event.clientX, session);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragSession.current = null;
    setIsDragging(false);
    if (newStartTime === session.initialStartTime || !onMove) {
      setPreviewStartTime(null);
      return;
    }

    setPreviewStartTime(newStartTime);
    void onMove(newStartTime).then(
      () => setPreviewStartTime(null),
      () => setPreviewStartTime(null)
    );
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = dragSession.current;
    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    resetDrag(event);
  };

  const onReady = (ws: WaveSurfer) => {
    waveSurferRef.current = ws;
    ws.setVolume(0);
    ws.zoom(coordinateMapper.pixelsPerSecond);

    const rootNode = ws.getWrapper().getRootNode();
    if (rootNode instanceof ShadowRoot) {
      const shadowRoot = rootNode;
      const styleId = 'wavesurfer-style-overrides';
      if (!shadowRoot.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          .scroll {
            overflow-x: hidden !important;
            overflow-y: hidden !important;
          }
          .scroll::-webkit-scrollbar {
            display: none;
          }
        `;
        shadowRoot.appendChild(style);
      }
    }

    if (onReadyProp) {
      onReadyProp(ws);
    }
  };

  return (
    <div
      className={`${styles.regionContainer} ${selected ? styles.selectedRegion : ''}`}
      data-region-id={region.id}
      data-selected={selected}
      aria-label={`Region ${region.id}`}
      tabIndex={0}
      style={{
        transform: `translateX(${left}px)`,
        width: `${width}px`,
        position: 'absolute',
        top: 0,
        height: '100%',
        overflow: 'hidden',
        cursor: onMove ? (isDragging ? 'grabbing' : previewStartTime !== null ? 'wait' : 'grab') : 'default',
        touchAction: onMove ? 'none' : 'auto',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={handleKeyDown}
    >
      {displayedFadeInDuration > 0 ? (
        <div
          className={`${styles.fadeRamp} ${styles.fadeInRamp}`}
          style={{
            width: coordinateMapper.durationToPixels({
              durationSeconds: displayedFadeInDuration,
              startSeconds: region.startTime,
            }),
          }}
        />
      ) : null}
      {displayedFadeOutDuration > 0 ? (
        <div
          className={`${styles.fadeRamp} ${styles.fadeOutRamp}`}
          style={{
            width: coordinateMapper.durationToPixels({
              durationSeconds: displayedFadeOutDuration,
              startSeconds: region.startTime + region.duration - displayedFadeOutDuration,
            }),
          }}
        />
      ) : null}
      {selected && onFadeChange ? (
        <>
          <button
            type="button"
            className={`${styles.fadeHandle} ${styles.fadeInHandle}`}
            aria-label="Region fade in"
            style={{
              left:
                coordinateMapper.durationToPixels({
                  durationSeconds: displayedFadeInDuration,
                  startSeconds: region.startTime,
                }) - 5,
            }}
            onPointerCancel={handleFadePointerCancel}
            onPointerDown={event => handleFadePointerDown('in', event)}
            onPointerMove={handleFadePointerMove}
            onPointerUp={handleFadePointerUp}
          />
          <button
            type="button"
            className={`${styles.fadeHandle} ${styles.fadeOutHandle}`}
            aria-label="Region fade out"
            style={{
              right:
                coordinateMapper.durationToPixels({
                  durationSeconds: displayedFadeOutDuration,
                  startSeconds: region.startTime + region.duration - displayedFadeOutDuration,
                }) - 5,
            }}
            onPointerCancel={handleFadePointerCancel}
            onPointerDown={event => handleFadePointerDown('out', event)}
            onPointerMove={handleFadePointerMove}
            onPointerUp={handleFadePointerUp}
          />
        </>
      ) : null}
      {onTrim ? (
        <>
          <button
            type="button"
            className={`${styles.trimHandle} ${styles.startTrimHandle}`}
            aria-label="Region 시작 trim"
            onPointerCancel={handleTrimPointerCancel}
            onPointerDown={event => handleTrimPointerDown('start', event)}
            onPointerMove={handleTrimPointerMove}
            onPointerUp={handleTrimPointerUp}
          />
          <button
            type="button"
            className={`${styles.trimHandle} ${styles.endTrimHandle}`}
            aria-label="Region 끝 trim"
            onPointerCancel={handleTrimPointerCancel}
            onPointerDown={event => handleTrimPointerDown('end', event)}
            onPointerMove={handleTrimPointerMove}
            onPointerUp={handleTrimPointerUp}
          />
        </>
      ) : null}
      {onRemove ? (
        <button
          type="button"
          className={styles.removeButton}
          aria-label="Region 삭제"
          title="Region 삭제"
          onPointerDown={event => event.stopPropagation()}
          onClick={onRemove}
        >
          ×
        </button>
      ) : null}
      {audioSourceUrl === null ? (
        <div role="alert">{MISSING_AUDIO_SOURCE_MESSAGE}</div>
      ) : (
        <div
          style={{
            marginLeft: `-${coordinateMapper.secondsToPixels(trimPreview?.sourceStartTimeSeconds ?? region.sourceStartTime)}px`,
            height: '100%',
          }}
        >
          <WavesurferPlayer
            duration={waveformRenderSelection.current.renderData?.duration}
            height={TRACK_WAVEFORM_HEIGHT}
            peaks={waveformRenderSelection.current.renderData?.peaks}
            waveColor="#ff8fe8"
            progressColor="#ffc4f2"
            url={audioSourceUrl}
            onReady={onReady}
            interact={false}
            cursorWidth={0}
            autoScroll={false}
          />
        </div>
      )}
    </div>
  );
};
