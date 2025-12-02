import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import type { AudioEngine } from '../../../core/audio';
import { useTransportTicker } from '../../../hooks/useTransportTicker';
import * as styles from '../DAW.css';

interface TransportPositionDisplayProps {
  engine: AudioEngine;
  bpm: number;
  isPlaying: boolean;
}

/**
 * Ardour UI의 clock 위젯을 모사한 트랜스포트 위치 표시 컴포넌트.
 * requestAnimationFrame 기반 ticker를 내부에서 관리하여
 * 상위 DAW 컴포넌트를 불필요하게 리렌더하지 않는다.
 *
 * 더블클릭하면 위치를 직접 입력할 수 있다 (Ardour처럼).
 */
export function TransportPositionDisplay({
  engine,
  bpm,
  isPlaying,
}: TransportPositionDisplayProps) {
  const [position, setPosition] = useState(engine.getPosition());
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const updatePosition = useCallback(
    (nextPosition: number) => {
      // 편집 중이 아닐 때만 위치 업데이트
      if (!isEditing) {
        setPosition(nextPosition);
      }
    },
    [isEditing]
  );

  useTransportTicker(engine, isPlaying, updatePosition);

  const formatted = useMemo(() => {
    const mins = Math.floor(position / 60);
    const secs = Math.floor(position % 60);
    const time = `${mins}:${secs.toString().padStart(2, '0')}`;

    const beatsPerBar = 4; // TODO: TempoMap 연동
    const secondsPerBeat = 60 / bpm;
    const secondsPerBar = secondsPerBeat * beatsPerBar;
    const bar = Math.floor(position / secondsPerBar) + 1;
    const beat = Math.floor((position % secondsPerBar) / secondsPerBeat) + 1;
    const bbt = `${bar}:${beat}`;

    return { time, bbt };
  }, [position, bpm]);

  // 편집 모드 시작 (더블클릭만 - Ardour처럼)
  const handleDoubleClick = useCallback(() => {
    setIsEditing(true);
    setEditValue(formatted.time);
  }, [formatted.time]);

  // 위치 파싱 (MM:SS 형식 또는 초 단위 숫자)
  const parsePosition = useCallback((value: string): number | null => {
    // MM:SS 형식 파싱
    const timeMatch = value.match(/^(\d+):(\d+)$/);
    if (timeMatch) {
      const mins = parseInt(timeMatch[1], 10);
      const secs = parseInt(timeMatch[2], 10);
      return mins * 60 + secs;
    }

    // 숫자만 입력된 경우 초 단위로 처리
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      return numValue;
    }

    return null;
  }, []);

  // 위치 설정
  const handleSetPosition = useCallback(
    (newPosition: number) => {
      engine.setPosition(newPosition);
      setPosition(newPosition);
      setIsEditing(false);
    },
    [engine]
  );

  // Enter 키로 위치 설정
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const parsed = parsePosition(editValue);
        if (parsed !== null) {
          handleSetPosition(parsed);
        } else {
          setIsEditing(false);
        }
      } else if (e.key === 'Escape') {
        setIsEditing(false);
      }
    },
    [editValue, parsePosition, handleSetPosition]
  );

  // 입력 필드 포커스 (편집 모드 시작 시)
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  return (
    <div
      className={styles.positionDisplay}
      onDoubleClick={handleDoubleClick}
      style={{ cursor: 'pointer' }}
      title="더블클릭하여 위치 입력 (MM:SS 형식 또는 초 단위)"
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            const parsed = parsePosition(editValue);
            if (parsed !== null) {
              handleSetPosition(parsed);
            } else {
              setIsEditing(false);
            }
          }}
          className={styles.positionInput}
          placeholder="MM:SS 또는 초"
        />
      ) : (
        <>
          <span className={styles.positionTime}>{formatted.time}</span>
          <span className={styles.positionBBT}>{formatted.bbt}</span>
        </>
      )}
    </div>
  );
}
