import { useRef, useMemo, useEffect, useCallback } from 'react';
import {
  DEFAULT_TIMELINE_DURATION,
  PIXELS_PER_SECOND,
} from '../../../constants/audio';
import { RulerWrapper } from '../Ruler/RulerWrapper';
import { useScrollSync } from '../../../hooks/useScrollSync';
import { TrackRow } from './TrackRow';
import type { TrackTimelineProps } from '../../../types/daw';
import * as styles from './TrackTimeline.css';
import { useTransportTicker } from '../../../hooks/useTransportTicker';

/**
 * 트랙 리스트 + 타임라인 통합 컴포넌트
 * 왼쪽: 트랙 컨트롤 (이름, 볼륨, Mute, Solo)
 * 오른쪽: 타임라인 파형
 */
export function TrackTimeline({
  engine,
  tracks,
  isPlaying,
  onTrackVolumeChange,
  onTrackMute,
  onTrackSolo,
  onTrackPanChange,
  onTrackDelete,
}: TrackTimelineProps) {
  const rulerScrollRef = useRef<HTMLDivElement>(null);
  const timelineScrollRefs = useRef<Map<number, HTMLDivElement | null>>(
    new Map()
  );
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const rulerPlayheadRef = useRef<HTMLDivElement | null>(null);

  // 동적 타임라인 길이 계산 (클립들의 최대 종료지점) - useMemo로 최적화
  const computedDuration = useMemo(() => {
    let maxEnd = 0;
    for (const track of tracks) {
      const clips = track.getClips();
      for (const clip of clips) {
        const end = clip.getStartTime() + clip.getDuration();
        if (end > maxEnd) maxEnd = end;
      }
    }
    return Math.max(DEFAULT_TIMELINE_DURATION, maxEnd);
  }, [tracks]);

  const contentWidthPx = useMemo(
    () => Math.ceil(computedDuration * PIXELS_PER_SECOND),
    [computedDuration]
  );

  // 스크롤 동기화 (하단 스크롤바 포함)
  useScrollSync<HTMLDivElement>({
    rulerRef: rulerScrollRef,
    timelineRefs: timelineScrollRefs,
    bottomScrollRef: bottomScrollRef,
    trackCount: tracks.length,
  });

  // Ardour처럼 이전 위치를 기억하여 변경된 경우에만 업데이트
  const lastPositionRef = useRef<number>(-1);

  const updatePlayheadPosition = useCallback(
    (positionSeconds: number) => {
      // 위치가 변경되지 않았으면 업데이트 스킵
      if (lastPositionRef.current === positionSeconds) {
        return;
      }

      lastPositionRef.current = positionSeconds;

      const safeDuration =
        computedDuration > 0 ? computedDuration : DEFAULT_TIMELINE_DURATION;
      const ratio = Math.min(Math.max(positionSeconds / safeDuration, 0), 1);

      // Ardour처럼 DOM 직접 조작으로 빠른 업데이트
      // 글로벌 플레이헤드 위치 업데이트 (룰러 스크롤 컨테이너 기준)
      if (rulerPlayheadRef.current && rulerScrollRef.current) {
        const scrollLeft = rulerScrollRef.current.scrollLeft;
        const contentWidth = rulerScrollRef.current.scrollWidth;
        const positionPx = ratio * contentWidth;
        // 룰러 스페이서(296px) + 스크롤 오프셋을 고려한 절대 위치
        rulerPlayheadRef.current.style.left = `${296 + positionPx - scrollLeft}px`;
      }
    },
    [computedDuration]
  );

  // Ardour처럼 플레이헤드는 항상 표시 (재생 중일 때만 더 밝게)
  const setPlayheadVisibility = useCallback((visible: boolean) => {
    // 재생 중일 때는 opacity 1, 일시정지일 때는 약간 투명하게 (위치는 유지)
    const opacity = visible ? '1' : '0.6';
    if (rulerPlayheadRef.current) {
      rulerPlayheadRef.current.style.opacity = opacity;
    }
  }, []);

  // Ardour처럼 항상 Transport 위치를 읽어서 플레이헤드 업데이트
  // 재생 상태와 무관하게 항상 현재 위치를 표시
  useTransportTicker(engine, isPlaying, updatePlayheadPosition);

  useEffect(() => {
    // 재생 상태 변경 시 가시성만 조절 (위치는 useTransportTicker가 관리)
    setPlayheadVisibility(isPlaying);
  }, [isPlaying, setPlayheadVisibility]);

  // 스크롤 시 플레이헤드 위치 동기화
  useEffect(() => {
    const handleScroll = () => {
      if (
        rulerPlayheadRef.current &&
        rulerScrollRef.current &&
        lastPositionRef.current >= 0
      ) {
        const scrollLeft = rulerScrollRef.current.scrollLeft;
        const contentWidth = rulerScrollRef.current.scrollWidth;
        const safeDuration =
          computedDuration > 0 ? computedDuration : DEFAULT_TIMELINE_DURATION;
        const ratio = Math.min(
          Math.max(lastPositionRef.current / safeDuration, 0),
          1
        );
        const positionPx = ratio * contentWidth;
        rulerPlayheadRef.current.style.left = `${296 + positionPx - scrollLeft}px`;
      }
    };

    const scrollContainer = rulerScrollRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
      };
    }
  }, [computedDuration]);

  // Ardour처럼 룰러/타임라인 클릭 시 플레이헤드 이동
  const handleRulerClick = useCallback(
    (positionSeconds: number) => {
      engine.setPosition(positionSeconds);
      // 즉시 플레이헤드 위치 업데이트 (useTransportTicker가 재생 중이 아닐 때는 업데이트하지 않으므로)
      updatePlayheadPosition(positionSeconds);
    },
    [engine, updatePlayheadPosition]
  );

  const handleTimelineClick = useCallback(
    (positionSeconds: number) => {
      engine.setPosition(positionSeconds);
      // 즉시 플레이헤드 위치 업데이트
      updatePlayheadPosition(positionSeconds);
    },
    [engine, updatePlayheadPosition]
  );

  return (
    <div className={styles.container}>
      {/* 타임라인 룰러 */}
      <RulerWrapper
        ref={rulerScrollRef}
        engine={engine}
        playheadRef={rulerPlayheadRef}
        timelineDuration={computedDuration}
        onRulerClick={handleRulerClick}
      />

      {/* 글로벌 플레이헤드 (룰러 + 트랙 전체) */}
      <div
        className={styles.globalPlayhead}
        ref={rulerPlayheadRef}
        style={{
          left: '0%',
          opacity: isPlaying ? '1' : '0.6',
          height: `${40 + tracks.length * 80}px`, // 룰러 높이(40px) + 각 트랙 높이(80px)
        }}
      />

      {tracks.map((track, index) => (
        <TrackRow
          key={index}
          index={index}
          track={track}
          timelineScrollRefs={timelineScrollRefs}
          timelineContentWidthPx={contentWidthPx}
          timelineDuration={computedDuration}
          onVolumeChange={volume => onTrackVolumeChange(track, volume)}
          onMute={muted => onTrackMute(track, muted)}
          onSolo={solo => onTrackSolo(track, solo)}
          onPanChange={pan => onTrackPanChange?.(track, pan)}
          onDelete={() => onTrackDelete?.(track)}
          onTimelineClick={handleTimelineClick}
        />
      ))}

      {/* 하단 공통 스크롤바 */}
      <div className={styles.bottomScrollWrapper}>
        <div className={styles.bottomScrollSpacer} />
        <div className={styles.bottomScrollContainer} ref={bottomScrollRef}>
          <div
            style={{
              width: `${contentWidthPx}px`,
              minWidth: `${contentWidthPx}px`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
