import type { Track } from '@/types/track';
import WavesurferPlayer from '@wavesurfer/react';
import type WaveSurfer from 'wavesurfer.js';
import { TrackPanController } from './components/TrackPanController';
import { TrackVolumeController } from './components/TrackVolumeController';

export const TrackComponent = ({
  mediaElement,
  track,
  onReady,
  onVolumeChange,
  onPanChange,
}: {
  mediaElement: HTMLMediaElement | null;
  track: Track;
  onReady: (ws: WaveSurfer) => void;
  onVolumeChange: (volume: number) => void;
  onPanChange: (pan: number) => void;
}) => {
  return (
    <>
      <WavesurferPlayer
        url={track.regions[0].audioFile.url}
        onReady={ws => {
          onReady(ws);
          // Mute the visualization audio element because AudioEngine handles the sound
          ws.setVolume(0);

          const shadowRoot = ws.getWrapper()?.getRootNode();
          injectShadowRootOverflowHidden({ shadowRoot });
        }}
        interact={false}
        cursorWidth={0} /** @note wavesurfer의 cursor를 가리기 위함 */
        fillParent={false}
        hideScrollbar={true}
        autoScroll={false}
      />
      {/* Volume Controller: Updates Store AND AudioEngine */}
      {mediaElement ? (
        <TrackVolumeController
          volume={track.volume ?? 1}
          onVolumeChange={onVolumeChange}
        />
      ) : null}
      {mediaElement ? (
        <TrackPanController pan={track.pan ?? 0} onPanChange={onPanChange} />
      ) : null}
    </>
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
