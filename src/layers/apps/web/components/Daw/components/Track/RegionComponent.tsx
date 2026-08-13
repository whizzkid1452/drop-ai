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

interface WaveformRenderSelection {
  objectUrl: string | null;
  renderData: WaveformRenderData | null;
}

interface RegionComponentProps {
  region: RegionState;
  coordinateMapper: TimelineCoordinateMapper;
  gridSettings: TimelineGridSettings;
  onReady?: (ws: WaveSurfer) => void;
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
  onMove,
  onRemove,
  onSelect,
  onTrim,
  selected = false,
  waveformRenderData,
}: RegionComponentProps) => {
  const audioSourceResolver = useAudioSourceResolver();
  const dragSession = useRef<RegionDragSession | null>(null);
  const trimSession = useRef<RegionTrimSession | null>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewStartTime, setPreviewStartTime] = useState<number | null>(null);
  const [trimPreview, setTrimPreview] = useState<RegionTrimPreview | null>(null);
  const displayedStartTime = trimPreview?.startTimeSeconds ?? previewStartTime ?? region.startTime;
  const displayedDuration = trimPreview?.durationSeconds ?? region.duration;
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
