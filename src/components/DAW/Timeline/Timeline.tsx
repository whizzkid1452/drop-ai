import { useCallback } from 'react';
import { Track } from '../../../core/audio';
import {
  TRACK_COLOR_PALETTE,
  PIXELS_PER_SECOND,
} from '../../../constants/audio';
import type { TimelineProps, ClipRegionProps } from '../../../types/daw';
import type { WaveformStyle } from '../../../types/ui';
import * as styles from './Timeline.css';
import Waveform from '../Waveform/Waveform';

// Props moved to src/types/daw.ts

/**
 * 타임라인 뷰 컴포넌트 (Ardour 스타일)
 * - 파형 시각화
 * - 리전(클립) 배치
 * - 플레이헤드
 * - 클릭 시 플레이헤드 이동 (Ardour처럼)
 */
export function Timeline({
  tracks,
  timelineDuration,
  onTimelineClick,
}: TimelineProps) {
  // Ardour처럼 타임라인 클릭 시 플레이헤드 이동
  const handleTimelineClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!onTimelineClick) return;

      // 클립이 아닌 빈 공간을 클릭한 경우에만 플레이헤드 이동
      const target = event.target as HTMLElement;
      if (target.closest(`.${styles.clip}`)) {
        return; // 클립 클릭은 무시
      }

      // 클릭한 위치의 X 좌표를 타임라인 상대 좌표로 변환
      const timelineContent = event.currentTarget;
      const rect = timelineContent.getBoundingClientRect();
      const clickX = event.clientX - rect.left;

      // 스크롤 오프셋 고려 (실제 스크롤 컨테이너 찾기)
      let scrollLeft = 0;
      let currentElement: HTMLElement | null = timelineContent.parentElement;

      // 스크롤 가능한 부모 요소 찾기
      while (currentElement) {
        if (
          currentElement.scrollLeft > 0 ||
          currentElement.scrollWidth > currentElement.clientWidth
        ) {
          scrollLeft = currentElement.scrollLeft;
          break;
        }
        currentElement = currentElement.parentElement;
      }

      const totalX = clickX + scrollLeft;

      // 픽셀을 시간(초)으로 변환
      const positionSeconds = totalX / PIXELS_PER_SECOND;

      // 타임라인 범위 내로 제한
      const clampedPosition = Math.max(
        0,
        Math.min(positionSeconds, timelineDuration)
      );

      onTimelineClick(clampedPosition);
    },
    [onTimelineClick, timelineDuration]
  );

  return (
    <div className={styles.container}>
      <div className={styles.timelineContent} onClick={handleTimelineClick}>
        {tracks.length === 0 ? (
          <div className={styles.emptyState}>
            <p>트랙이 없습니다. 파일을 업로드하세요.</p>
          </div>
        ) : (
          tracks.map((track, trackIndex) => (
            <TrackRow
              key={trackIndex}
              track={track}
              timelineDuration={timelineDuration}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface TrackRowProps {
  track: Track;
  timelineDuration: number;
}

function TrackRow({ track, timelineDuration }: TrackRowProps) {
  const clips = track.getClips();

  return (
    <div className={styles.trackRow}>
      {clips.length === 0 ? (
        <div className={styles.emptyClip}>
          <span>클립을 여기에 드래그하세요</span>
        </div>
      ) : (
        clips.map((clip, clipIndex) => {
          const clipWidth = (clip.getDuration() / timelineDuration) * 100;
          const clipLeft = (clip.getStartTime() / timelineDuration) * 100;

          // 트랙별 다른 파형 스타일 (트랙 인덱스에 따라 색상 변경)
          const trackIndex = Array.from(track.getName()).reduce(
            (acc, char) => acc + char.charCodeAt(0),
            0
          );
          const waveformStyle: WaveformStyle = {
            lineColor:
              TRACK_COLOR_PALETTE[trackIndex % TRACK_COLOR_PALETTE.length],
            fillColor: `${
              TRACK_COLOR_PALETTE[trackIndex % TRACK_COLOR_PALETTE.length]
            }20`,
            lineWidth: 1.5,
            height: 60,
            showCenterLine: true,
          };

          return (
            <ClipRegion
              key={clipIndex}
              clipLeft={clipLeft}
              clipWidth={clipWidth}
              clipIndex={clipIndex}
              buffer={clip.getBuffer()}
              style={waveformStyle}
            />
          );
        })
      )}
    </div>
  );
}

// WaveformStyle moved to src/@types/ui.ts

// Props moved to src/types/daw.ts

function ClipRegion({
  clipLeft,
  clipWidth,
  clipIndex,
  buffer,
  style = {},
}: ClipRegionProps) {
  return (
    <div
      className={styles.clip}
      style={{
        left: `${clipLeft}%`,
        width: `${clipWidth}%`,
      }}
    >
      <Waveform buffer={buffer} style={style} className={styles.waveform} />
      <div className={styles.clipName}>{`${clipIndex + 1}`}</div>
    </div>
  );
}
