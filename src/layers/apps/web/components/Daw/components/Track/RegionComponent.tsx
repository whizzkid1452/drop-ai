import WavesurferPlayer from '@wavesurfer/react';
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import * as styles from './RegionComponent.css.ts';
import type { RegionState } from '@/layers/session/session';
import { calculateRegionDragStartTime } from '@/layers/apps/web/hooks/calculate-region-drag-start-time';

interface RegionDragSession {
  pointerId: number;
  initialPointerX: number;
  initialStartTime: number;
}

interface RegionComponentProps {
  region: RegionState;
  pixelsPerSecond: number;
  onReady?: (ws: WaveSurfer) => void;
  onMove?: (newStartTime: number) => Promise<void>;
  onRemove?: () => void;
}

export const RegionComponent = ({
  region,
  pixelsPerSecond,
  onReady: onReadyProp,
  onMove,
  onRemove,
}: RegionComponentProps) => {
  const dragSession = useRef<RegionDragSession | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewStartTime, setPreviewStartTime] = useState<number | null>(null);
  const displayedStartTime = previewStartTime ?? region.startTime;
  const left = displayedStartTime * pixelsPerSecond;
  const width = region.duration * pixelsPerSecond;

  const calculateStartTime = (pointerX: number, session: RegionDragSession) =>
    calculateRegionDragStartTime({
      initialStartTime: session.initialStartTime,
      initialPointerX: session.initialPointerX,
      currentPointerX: pointerX,
      pixelsPerSecond,
    });

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0 || !onMove || dragSession.current || previewStartTime !== null) {
      return;
    }

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
    ws.setVolume(0);
    ws.zoom(pixelsPerSecond);

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
      className={styles.regionContainer}
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
    >
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
      <div
        style={{
          marginLeft: `-${region.sourceStartTime * pixelsPerSecond}px`,
          height: '100%',
        }}
      >
        <WavesurferPlayer
          height={100}
          waveColor="#555"
          progressColor="#555"
          url={region.audioFileUrl}
          onReady={onReady}
          interact={false}
          cursorWidth={0}
          autoScroll={false}
        />
      </div>
    </div>
  );
};
