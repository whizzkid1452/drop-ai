import { useState } from 'react';
import { Track } from '../../../core/audio';
import type { TrackListProps } from '../../../types/daw';
import * as styles from './TrackList.css';

// Props moved to src/types/daw.ts

/**
 * 트랙 리스트 컴포넌트 (Ardour 스타일)
 */
export function TrackList({
  tracks,
  onTrackVolumeChange,
  onTrackMute,
  onTrackSolo,
}: TrackListProps) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerItem}>트랙</div>
        <div className={styles.headerItem}>볼륨</div>
        <div className={styles.headerItem}>Mute</div>
        <div className={styles.headerItem}>Solo</div>
      </div>

      <div className={styles.trackList}>
        {tracks.map((track, index) => (
          <TrackRow
            key={index}
            track={track}
            onVolumeChange={volume => onTrackVolumeChange(track, volume)}
            onMute={muted => onTrackMute(track, muted)}
            onSolo={solo => onTrackSolo(track, solo)}
          />
        ))}
      </div>
    </div>
  );
}

interface TrackRowProps {
  track: Track;
  onVolumeChange: (volume: number) => void;
  onMute: (muted: boolean) => void;
  onSolo: (solo: boolean) => void;
}

function TrackRow({ track, onVolumeChange, onMute, onSolo }: TrackRowProps) {
  const [volume, setVolume] = useState(track.getVolume());
  const [muted, setMuted] = useState(track.isMutedState());
  const [solo, setSolo] = useState(track.isSoloState());

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number(e.target.value);
    setVolume(newVolume);
    track.setVolume(newVolume);
    onVolumeChange(newVolume);
  };

  const handleMute = () => {
    const newMuted = !muted;
    setMuted(newMuted);
    track.setMuted(newMuted);
    onMute(newMuted);
  };

  const handleSolo = () => {
    const newSolo = !solo;
    setSolo(newSolo);
    track.setSolo(newSolo);
    onSolo(newSolo);
  };

  return (
    <div className={styles.trackRow}>
      <div className={styles.trackName}>{track.getName()}</div>

      <div className={styles.volumeControl}>
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={handleVolumeChange}
          className={styles.volumeSlider}
        />
        <span className={styles.volumeValue}>{Math.round(volume)}%</span>
      </div>

      <button
        className={`${styles.controlButton} ${muted ? styles.active : ''}`}
        onClick={handleMute}
        title="Mute"
      >
        🚫
      </button>

      <button
        className={`${styles.controlButton} ${solo ? styles.active : ''}`}
        onClick={handleSolo}
        title="Solo"
      >
        🎧
      </button>

      <div className={styles.clipInfo}>{track.getClips().length} 클립</div>
    </div>
  );
}
