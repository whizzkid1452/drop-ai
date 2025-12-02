import { useEffect, useRef } from 'react';
import type { AudioEngine } from '../core/audio';

type TransportTickHandler = (positionSeconds: number) => void;

/**
 * Ardour 스타일의 transport ticker.
 * AudioEngine의 위치를 requestAnimationFrame 주기로 전달한다.
 * 부모 컴포넌트 전체를 리렌더하지 않고, 필요 영역만 갱신할 수 있게 콜백 기반으로 제공한다.
 * 
 * Ardour의 playhead_cursor()->current_sample()과 동일하게,
 * 재생 상태와 무관하게 항상 현재 Transport 위치를 읽어서 전달한다.
 */
export function useTransportTicker(
  engine: AudioEngine,
  isPlaying: boolean,
  onTick: TransportTickHandler
): void {
  const rafIdRef = useRef<number | null>(null);
  const onTickRef = useRef(onTick);

  // 콜백 ref 업데이트 (의존성 배열을 피하기 위해)
  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  useEffect(() => {
    // 기존 루프 정리
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    const tick = () => {
      // Ardour처럼 항상 Transport의 현재 위치를 읽어서 전달
      // 일시정지 상태에서도 pauseTime을 반환하므로 항상 유효한 값
      const position = engine.getPosition();
      onTickRef.current(position);

      // 재생 중일 때는 빠르게 업데이트, 재생 중이 아닐 때는 느리게 업데이트
      // (위치가 변경될 수 있으므로 주기적으로 확인)
      rafIdRef.current = requestAnimationFrame(tick);
    };

    // 초기 위치 즉시 반영 (재생 상태와 무관)
    // requestAnimationFrame을 사용하여 다음 프레임에 실행하여
    // Transport의 pause/resume이 완료된 후 위치를 읽도록 보장
    rafIdRef.current = requestAnimationFrame(() => {
      tick();
    });

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [engine, isPlaying]);
}

