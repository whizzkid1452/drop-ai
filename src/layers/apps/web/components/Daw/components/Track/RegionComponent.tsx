// import { useRef } from 'react';
import WavesurferPlayer from '@wavesurfer/react';
import * as styles from './RegionComponent.css.ts';
import type { RegionState } from '@/layers/session';

interface RegionComponentProps {
  region: RegionState;
  pixelsPerSecond: number;
  onReady?: (ws: any) => void;
}

export const RegionComponent = ({
  region,
  pixelsPerSecond,
  onReady: onReadyProp,
}: RegionComponentProps) => {
  const left = region.startTime * pixelsPerSecond;
  const width = region.duration * pixelsPerSecond;

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
      }}
    >
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
