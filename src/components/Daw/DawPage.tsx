import { useMemo, useState } from 'react';
import { AudioFileDrop } from '../common/FileDrop/AudioFileDrop';
import { DawHeader } from './components/DawHeader';
import { TrackList } from './components/TrackList';
import { CliInterface } from './components/CliInterface';
import * as styles from './DawPage.css';
import { useTrackStore } from '@/stores/useTrackStore';

export function DawPage() {
  const tracks = useTrackStore(state => state.tracks);
  const hasTracks = useMemo(() => tracks.size > 0, [tracks.size]);
  const [isCliOpen, setIsCliOpen] = useState(false);

  return (
    <div className={styles.container}>
      {/* CLI Toggle Button */}
      <button
        className={`${styles.cliToggleButton} ${isCliOpen ? styles.cliToggleButtonOpen : ''}`}
        onClick={() => setIsCliOpen(!isCliOpen)}
        title={isCliOpen ? 'Close CLI' : 'Open CLI'}
      >
        {isCliOpen ? '→' : '←'}
      </button>

      <div className={styles.mainContent}>
        <div className={styles.backgroundGrid} />
        <div className={styles.glowEffect} />
        <div className={styles.waveAnimation} />

        {hasTracks ? (
          <>
            <DawHeader trackCount={tracks.size} />
            <TrackList />
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
        className={`${styles.cliPanel} ${!isCliOpen ? styles.cliPanelCollapsed : ''}`}
      >
        <CliInterface />
      </div>
    </div>
  );
}
