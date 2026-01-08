import type { Region } from '@/types/track';
import WavesurferPlayer from '@wavesurfer/react';
import type WaveSurfer from 'wavesurfer.js';
import * as styles from './RegionComponent.css';

interface RegionComponentProps {
    region: Region;
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
    // Calculate visual offset for sourceStart
    // If the region starts at 5s in the file, we pull the waveform left by 5s worth of pixels
    const visualOffset = -(region.sourceStart * pixelsPerSecond);

    return (
        <div
            className={styles.regionContainer}
            style={{
                left: `${left}px`,
                width: `${width}px`,
            }}
        >
            <div
                className={styles.waveformContainer}
                style={{
                    marginLeft: `${visualOffset}px`,
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
