import { useState, useRef, useEffect, useCallback } from 'react';
import WavesurferPlayer from '@wavesurfer/react';
import * as styles from './RegionComponent.css.ts';
import type { RegionState } from '@/layers/session';
import { useTrackActions } from '@/layers/apps/web/hooks/useTrackActions';

interface RegionComponentProps {
  trackId: string;
  region: RegionState;
  pixelsPerSecond: number;
  onReady?: (ws: any) => void;
}

export const RegionComponent = ({
  trackId,
  region,
  pixelsPerSecond,
  onReady: onReadyProp,
}: RegionComponentProps) => {
  const { moveRegion } = useTrackActions();
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const dragStartXRef = useRef<number>(0);
  const originalStartTimeRef = useRef<number>(0);

  const left = region.startTime * pixelsPerSecond;
  const width = region.duration * pixelsPerSecond;
  
  // 드래그 중일 때는 offset을 더한 위치를 보여줌
  const currentLeft = left + dragOffsetPx;

  const onReady = (ws: any) => {
    ws.setVolume(0);
    ws.zoom(pixelsPerSecond);
    
    // Shadow DOM style injection to hide scrollbars
    if (ws.renderer?.container?.shadowRoot) {
      const shadowRoot = ws.renderer.container.shadowRoot;
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

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    originalStartTimeRef.current = region.startTime;
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const deltaPx = e.clientX - dragStartXRef.current;
    setDragOffsetPx(deltaPx);
  }, []);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    const deltaPx = e.clientX - dragStartXRef.current;
    const deltaTime = deltaPx / pixelsPerSecond;
    const newStartTime = Math.max(0, originalStartTimeRef.current + deltaTime);

    // If position didn't effectively change, reset immediately
    if (Math.abs(deltaTime) < 0.001) {
        setDragOffsetPx(0);
        return;
    }

    // Call Controller to update Backend
    moveRegion(trackId, region.id, newStartTime);
    
    // Reset offset immediately after calling moveRegion
    // The visual position will jump to newStartTime calculated from the updated prop
    setDragOffsetPx(0);

  }, [moveRegion, trackId, region.id, pixelsPerSecond]);

  useEffect(() => {
      return () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
      }
  }, [handleMouseMove, handleMouseUp]);



  return (
    <div
      className={styles.regionContainer}
      onMouseDown={handleMouseDown}
      style={{
        transform: `translateX(${currentLeft}px)`,
        width: `${width}px`,
        position: 'absolute',
        top: 0,
        height: '100%',
        overflow: 'hidden',
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: isDragging ? 10 : 1,
      }}
    >
      <div
        style={{
          marginLeft: `-${region.sourceStartTime * pixelsPerSecond}px`,
          height: '100%',
          pointerEvents: 'none', // 내부 웨이브폼 클릭 방지
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
