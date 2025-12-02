import { useState, useEffect } from 'react';
import { Timeline } from '../Timeline/Timeline';
import { PanKnob } from '../Mixer/PanKnob';
import type { TrackRowProps } from '../../../types/daw';
import * as styles from './TrackTimeline.css';

/**
 * 개별 트랙 행 컴포넌트
 * 왼쪽: 트랙 컨트롤 (이름, 볼륨, Mute, Solo, Pan)
 * 오른쪽: 타임라인 파형
 */
export function TrackRow({
  index,
  track,
  timelineScrollRefs,
  timelineContentWidthPx,
  timelineDuration,
  onVolumeChange,
  onMute,
  onSolo,
  onPanChange,
  onDelete,
  onTimelineClick,
}: TrackRowProps) {
  // 트랙 상태를 로컬 상태로 관리 (초기값은 트랙 객체에서 가져옴)
  const [volume, setVolume] = useState(track.getVolume());
  const [pan, setPan] = useState(track.getPan());
  const [muted, setMuted] = useState(track.isMutedState());
  const [solo, setSolo] = useState(track.isSoloState());

  // 트랙 객체의 상태 변화를 감지하여 동기화
  // 트랙 객체의 메서드 호출 결과를 직접 비교하여 불필요한 업데이트 방지
  useEffect(() => {
    const currentVolume = track.getVolume();
    const currentPan = track.getPan();
    const currentMuted = track.isMutedState();
    const currentSolo = track.isSoloState();

    // 값이 실제로 변경되었을 때만 상태 업데이트
    if (currentVolume !== volume) setVolume(currentVolume);
    if (currentPan !== pan) setPan(currentPan);
    if (currentMuted !== muted) setMuted(currentMuted);
    if (currentSolo !== solo) setSolo(currentSolo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number(e.target.value);
    setVolume(newVolume);
    onVolumeChange(newVolume);
  };

  const handleMute = () => {
    const newMuted = !muted;
    setMuted(newMuted);
    onMute(newMuted);
  };

  const handleSolo = () => {
    const newSolo = !solo;
    setSolo(newSolo);
    onSolo(newSolo);
  };

  const handlePanChange = (value: number) => {
    const clamped = Math.max(-100, Math.min(100, value));
    setPan(clamped);
    track.setPan(clamped);
    onPanChange?.(clamped);
  };

  return (
    <div
      className={styles.trackRow}
      style={{ borderLeft: `4px solid ${track.getColor()}` }}
    >
      {/* 왼쪽: 트랙 컨트롤 */}
      <div className={styles.trackControls}>
        <div className={styles.trackName} style={{ color: track.getColor() }}>
          {track.getName()}
        </div>

        {/* Pan Control */}
        <div className={styles.controlSection}>
          <div className={styles.panControl}>
            <div className={styles.buttonGroup}>
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

              {onDelete && (
                <button
                  className={styles.deleteButton}
                  onClick={onDelete}
                  title="Delete Track"
                >
                  🗑️
                </button>
              )}
            </div>
            <div className={styles.panKnobWrap}>
              <span className={styles.panValue}>
                {pan === 0
                  ? 'C'
                  : pan > 0
                    ? `R${Math.abs(pan)}`
                    : `L${Math.abs(pan)}`}
              </span>
              <PanKnob value={pan} onChange={handlePanChange} />
            </div>
          </div>
        </div>

        <div className={styles.controlSection}>
          <div className={styles.volumeSection}>
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
        </div>
      </div>

      {/* 오른쪽: 타임라인 */}
      <div
        className={styles.timelineContainer}
        ref={el => {
          if (el) {
            timelineScrollRefs.current.set(index, el);
          } else {
            timelineScrollRefs.current.delete(index);
          }
        }}
      >
        <div
          style={{
            width: `${timelineContentWidthPx}px`,
            minWidth: `${timelineContentWidthPx}px`,
          }}
        >
          <Timeline
            tracks={[track]}
            timelineDuration={timelineDuration}
            onTimelineClick={onTimelineClick}
          />
        </div>
      </div>
    </div>
  );
}
