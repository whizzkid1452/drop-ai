import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioFileDrop } from '../common/FileDrop/AudioFileDrop';
import { DawHeader } from './components/DawHeader/DawHeader';
import { TrackList } from './components/TrackList/TrackList';
import { Terminal } from './components/Terminals/Terminal';
import { TrackInfoSidebar } from './components/TrackInfoSidebar/TrackInfoSidebar';
import { TimeRuler } from './components/TimeRuler/TimeRuler';
import { PlaybackControls } from './components/PlaybackControls/PlaybackControls';
import * as styles from './DawPage.css.ts';
import { useSession } from '@/layers/apps/web/context/LayerContext';

const CHAT_PANEL_MIN_WIDTH = 280;
const CHAT_PANEL_MAX_WIDTH = 600;
const CHAT_PANEL_DEFAULT_WIDTH = 350;

export function DawPage() {
  const trackCount = useSession(state => state.tracks.size);
  const hasTracks = trackCount > 0;
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);
  const [isTrackInfoOpen, setIsTrackInfoOpen] = useState(false);
  const [chatPanelWidth, setChatPanelWidth] = useState(CHAT_PANEL_DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(20);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(CHAT_PANEL_DEFAULT_WIDTH);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = chatPanelWidth;
  }, [chatPanelWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = resizeStartXRef.current - e.clientX;
      const newWidth = Math.min(
        CHAT_PANEL_MAX_WIDTH,
        Math.max(CHAT_PANEL_MIN_WIDTH, resizeStartWidthRef.current + deltaX)
      );
      setChatPanelWidth(newWidth);
    };

    const handleMouseUp = () => setIsResizing(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  return (
    <div className={styles.container}>
      {/* Left (Track Info) Toggle Button */}
      <button
        className={`${styles.leftToggleButton} ${isTrackInfoOpen ? styles.leftToggleButtonOpen : ''
          }`}
        onClick={() => setIsTrackInfoOpen(!isTrackInfoOpen)}
        title={isTrackInfoOpen ? 'Close Track Info' : 'Open Track Info'}
      >
        {isTrackInfoOpen ? '←' : '→'}
      </button>

      {/* Right (Terminal) Toggle Button */}
      <button
        className={`${styles.cliToggleButton} ${isTerminalOpen ? styles.cliToggleButtonOpen : ''}`}
        style={isTerminalOpen ? { right: `${chatPanelWidth + 25}px` } : undefined}
        onClick={() => setIsTerminalOpen(!isTerminalOpen)}
        title={isTerminalOpen ? 'Close Terminal' : 'Open Terminal'}
      >
        {isTerminalOpen ? '→' : '←'}
      </button>

      <div
        className={`${styles.leftPanel} ${!isTrackInfoOpen ? styles.leftPanelCollapsed : ''
          }`}
      >
        <TrackInfoSidebar />
      </div>

      <div className={styles.mainContent}>
        <div className={styles.backgroundGrid} />
        <div className={styles.glowEffect} />
        <div className={styles.waveAnimation} />

        {hasTracks ? (
          <>
            <DawHeader trackCount={trackCount} />
            <TimeRuler pixelsPerSecond={pixelsPerSecond} />
            <TrackList pixelsPerSecond={pixelsPerSecond} setPixelsPerSecond={setPixelsPerSecond} />
            <PlaybackControls />
            <AudioFileDrop
              onAudioFileDrop={() => {
                // @todo: 추가시 트랙에 자동 추가 기능 추가 예정
              }}
            />
          </>
        ) : (
          <div className={styles.modalOverlay}>
            <div>
              <AudioFileDrop
                onAudioFileDrop={() => {
                  // @todo: 추가시 트랙에 자동 추가 기능 추가 예정
                }}
              />
            </div>
          </div>
        )}
      </div>
      <div
        className={`${styles.cliPanel} ${!isTerminalOpen ? styles.cliPanelCollapsed : ''} ${isResizing ? styles.cliPanelResizing : ''}`}
        style={
          isTerminalOpen
            ? { width: chatPanelWidth }
            : undefined
        }
      >
        {isTerminalOpen && (
          <div
            className={styles.resizeHandle}
            onMouseDown={handleResizeStart}
            title="드래그하여 크기 조절"
          />
        )}
        <Terminal />
      </div>
    </div>
  );
}
