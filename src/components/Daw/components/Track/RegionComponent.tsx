import type { RegionData } from '@/core/region/Region';
import WavesurferPlayer from '@wavesurfer/react';
import type WaveSurfer from 'wavesurfer.js';
import * as styles from './RegionComponent.css';

interface RegionComponentProps {
    region: RegionData;
    pixelsPerSecond: number;
    onReady: (ws: WaveSurfer) => void;
}

export const RegionComponent = ({
    region,
    pixelsPerSecond,
    onReady,
}: RegionComponentProps) => {
    const width = (region.endTime - region.startTime) * pixelsPerSecond;
    const left = region.startTime * pixelsPerSecond;
    // Calculate visual offset for sourceStartTime
    // If the region starts at 5s in the file, we pull the waveform left by 5s worth of pixels
    const visualOffset = -(region.sourceStartTime * pixelsPerSecond);

    if (!region.audioFile) {
        return null;
    }

    return (
        <div
            className={styles.regionContainer}
            style={{
                transform: `translateX(${left}px)`,
                width: `${width}px`,
            }}
        >
            <div
                className={styles.waveformContainer}
                style={{
                    transform: `translateX(${visualOffset}px)`,
                }}
            >
                <WavesurferPlayer
                    url={region.audioFile.url}
                    onReady={ws => {
                        onReady(ws);
                        ws.setVolume(0);
                        ws.zoom(pixelsPerSecond);
                        const shadowRoot = ws.getWrapper()?.getRootNode();
                        injectShadowRootOverflowHidden({ shadowRoot });
                    }}
                    interact={false}
                    cursorWidth={0}
                    fillParent={false}
                    hideScrollbar={true}
                    autoScroll={false}
                />
            </div>
        </div>
    );
};

/** @description wavesurfer의 scrollbar를 가리기 위함. shadowRoot 내부라 억지로 style 주입 */
function injectShadowRootOverflowHidden({ shadowRoot }: { shadowRoot: Node }) {
    if (shadowRoot instanceof ShadowRoot) {
        const styleId = 'drop-ai-wavesurfer-style';
        if (!shadowRoot.querySelector(`#${styleId}`)) {
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
}
