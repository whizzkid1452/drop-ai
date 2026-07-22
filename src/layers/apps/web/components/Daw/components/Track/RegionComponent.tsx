import WavesurferPlayer from '@wavesurfer/react';
import type WaveSurfer from 'wavesurfer.js';
import * as styles from './RegionComponent.css.ts';
import type { RegionState } from '@/layers/session/session';

interface RegionComponentProps {
  region: RegionState;
  pixelsPerSecond: number;
  onReady?: (ws: WaveSurfer) => void;
  onRemove?: () => void;
}

export const RegionComponent = ({ region, pixelsPerSecond, onReady: onReadyProp, onRemove }: RegionComponentProps) => {
  const left = region.startTime * pixelsPerSecond;
  const width = region.duration * pixelsPerSecond;

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
      }}
    >
      {onRemove ? (
        <button
          type="button"
          className={styles.removeButton}
          aria-label="Region 삭제"
          title="Region 삭제"
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
