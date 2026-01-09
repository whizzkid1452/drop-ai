import { useMemo, useState } from 'react';
import { AudioFileDrop } from '../common/FileDrop/AudioFileDrop';
import { DawHeader } from './components/DawHeader';
import { TrackList } from './components/TrackList';
import { Terminal } from './components/Terminals/Terminal';
import { TrackInfoSidebar } from './components/TrackInfoSidebar';
import { TimeRuler } from './components/TimeRuler/TimeRuler';
import { PlaybackControls } from './components/PlaybackControls/PlaybackControls';
import * as styles from './DawPage.css';
import { useTrackStore } from '@/stores/useTrackStore';

export function DawPage() {
  const tracks = useTrackStore(state => state.tracks);
  const hasTracks = useMemo(() => tracks.size > 0, [tracks.size]);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isTrackInfoOpen, setIsTrackInfoOpen] = useState(false);

  return (
    <div className={styles.container}>
      {/* Left (Track Info) Toggle Button */}
      <button
        className={`${styles.leftToggleButton} ${
          isTrackInfoOpen ? styles.leftToggleButtonOpen : ''
        }`}
        onClick={() => setIsTrackInfoOpen(!isTrackInfoOpen)}
        title={isTrackInfoOpen ? 'Close Track Info' : 'Open Track Info'}
      >
        {isTrackInfoOpen ? '←' : '→'}
      </button>

      {/* Right (Terminal) Toggle Button */}
      <button
        className={`${styles.cliToggleButton} ${isTerminalOpen ? styles.cliToggleButtonOpen : ''}`}
        onClick={() => setIsTerminalOpen(!isTerminalOpen)}
        title={isTerminalOpen ? 'Close Terminal' : 'Open Terminal'}
      >
        {isTerminalOpen ? '→' : '←'}
      </button>

      <div
        className={`${styles.leftPanel} ${
          !isTrackInfoOpen ? styles.leftPanelCollapsed : ''
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
            <DawHeader trackCount={tracks.size} />
            <TimeRuler />
            <TrackList />
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
        className={`${styles.cliPanel} ${!isTerminalOpen ? styles.cliPanelCollapsed : ''}`}
      >
        <Terminal />
      </div>
    </div>
  );
}
