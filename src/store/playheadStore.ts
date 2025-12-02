import { create } from 'zustand';

/**
 * 플레이헤드 위치를 전역으로 관리하는 Zustand Store
 *
 * 모든 컴포넌트에서 현재 재생 시간 정보를 공유할 수 있도록 합니다.
 * - Ruler: 플레이헤드 위치 표시
 * - TrackTimeline: 플레이헤드 위치 표시 및 업데이트
 * - TransportPositionDisplay: 현재 재생 시간 표시
 * - 기타 재생 시간 정보가 필요한 모든 컴포넌트
 */
interface PlayheadStore {
  /** 현재 플레이헤드 위치 (초 단위) */
  position: number;

  /** 플레이헤드 위치 설정 */
  setPosition: (position: number) => void;

  /** 재생 상태 (플레이헤드 가시성 제어용) */
  isPlaying: boolean;

  /** 재생 상태 설정 */
  setIsPlaying: (isPlaying: boolean) => void;
}

export const usePlayheadStore = create<PlayheadStore>(set => ({
  position: 0,
  isPlaying: false,
  setPosition: position => set({ position }),
  setIsPlaying: isPlaying => set({ isPlaying }),
}));

