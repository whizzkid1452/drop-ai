import { Track } from '../../../core/audio';
import * as styles from './Mixer.css';

/**
 * Mixer Panel 컴포넌트
 * Ardour 스타일의 믹서 뷰
 * 
 * 미구현 기능:
 * - 이펙트 슬롯
 * - Send/Return
 * - 미터링 (VU Meter)
 * - 스테레오 필드 시각화
 */
interface MixerProps {
  tracks: Track[];
  onTrackVolumeChange: (track: Track, volume: number) => void;
  onTrackMute: (track: Track, muted: boolean) => void;
  onTrackSolo: (track: Track, solo: boolean) => void;
  onTrackPanChange?: (track: Track, pan: number) => void;
}

export function Mixer({
  tracks: _tracks,
  onTrackVolumeChange: _onTrackVolumeChange,
  onTrackMute: _onTrackMute,
  onTrackSolo: _onTrackSolo,
  onTrackPanChange: _onTrackPanChange,
}: MixerProps) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>믹서</h3>
        <p className={styles.note}>
          믹서 패널은 아직 구현되지 않았습니다.
        </p>
      </div>

      {/* 미구현: 트랙별 믹서 스트립 */}
      {/* <div className={styles.mixerStrips}>
        {tracks.map((track, index) => (
          <MixerStrip
            key={index}
            track={track}
            onVolumeChange={volume => onTrackVolumeChange(track, volume)}
            onMute={muted => onTrackMute(track, muted)}
            onSolo={solo => onTrackSolo(track, solo)}
            onPanChange={pan => onTrackPanChange?.(track, pan)}
          />
        ))}
      </div> */}

      {/* 미구현: 마스터 버스 */}
      {/* <div className={styles.masterBus}>
        <MasterBusStrip />
      </div> */}
    </div>
  );
}

// 미구현: 개별 믹서 스트립 컴포넌트
/*
interface MixerStripProps {
  track: Track;
  onVolumeChange: (volume: number) => void;
  onMute: (muted: boolean) => void;
  onSolo: (solo: boolean) => void;
  onPanChange?: (pan: number) => void;
}

function MixerStrip({
  track,
  onVolumeChange,
  onMute,
  onSolo,
  onPanChange,
}: MixerStripProps) {
  const [volume, setVolume] = useState(track.getVolume());
  const [pan, setPan] = useState(track.getPan());
  const [muted, setMuted] = useState(track.isMutedState());
  const [solo, setSolo] = useState(track.isSoloState());

  return (
    <div className={styles.strip}>
      <div className={styles.stripHeader}>
        <div className={styles.trackName}>{track.getName()}</div>
      </div>

      <div className={styles.stripControls}>
        <div className={styles.meter}>
          미터링 (미구현)
        </div>

        <div className={styles.volumeControl}>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={e => {
              const newVolume = Number(e.target.value);
              setVolume(newVolume);
              onVolumeChange(newVolume);
            }}
            className={styles.volumeFader}
            orient="vertical"
          />
          <span className={styles.volumeValue}>{Math.round(volume)}%</span>
        </div>

        <div className={styles.panControl}>
          <input
            type="range"
            min="-100"
            max="100"
            value={pan}
            onChange={e => {
              const newPan = Number(e.target.value);
              setPan(newPan);
              onPanChange?.(newPan);
            }}
            className={styles.panSlider}
          />
        </div>

        <div className={styles.buttons}>
          <button
            className={`${styles.button} ${muted ? styles.active : ''}`}
            onClick={() => {
              const newMuted = !muted;
              setMuted(newMuted);
              onMute(newMuted);
            }}
          >
            M
          </button>
          <button
            className={`${styles.button} ${solo ? styles.active : ''}`}
            onClick={() => {
              const newSolo = !solo;
              setSolo(newSolo);
              onSolo(newSolo);
            }}
          >
            S
          </button>
        </div>

        <div className={styles.effectsSlots}>
          이펙트 슬롯 (미구현)
        </div>
      </div>
    </div>
  );
}

function MasterBusStrip() {
  return (
    <div className={styles.masterStrip}>
      <div className={styles.stripHeader}>
        <div className={styles.trackName}>Master</div>
      </div>
      <div className={styles.stripControls}>
        <div className={styles.meter}>
          마스터 미터링 (미구현)
        </div>
        <div className={styles.volumeControl}>
          <input
            type="range"
            min="0"
            max="100"
            value={100}
            className={styles.volumeFader}
            orient="vertical"
          />
        </div>
      </div>
    </div>
  );
}
*/

