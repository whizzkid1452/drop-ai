import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { AudioFile } from '@/components/DropZone/components/FileUpload/components/types';

/**
 * TrackContext가 제공하는 값의 타입 정의
 * - tracks: 현재 등록된 모든 오디오 파일 트랙 목록
 * - addTrack: 새로운 트랙을 추가하는 함수
 * - removeTrack: 특정 인덱스의 트랙을 제거하는 함수
 * - clearTracks: 모든 트랙을 제거하는 함수
 */
interface TrackContextValue {
  tracks: AudioFile[];
  addTrack: (file: AudioFile) => void;
  removeTrack: (index: number) => void;
  clearTracks: () => void;
}

/**
 * 트랙 관리를 위한 React Context 생성
 * 전역적으로 트랙 상태를 공유하기 위해 사용됩니다.
 */
const TrackContext = createContext<TrackContextValue | undefined>(undefined);

/**
 * TrackProvider 컴포넌트
 * 
 * 트랙 상태를 관리하고 하위 컴포넌트에 제공하는 Provider입니다.
 * - 업로드된 오디오 파일들을 전역 상태로 관리
 * - 트랙 추가/제거/전체 삭제 기능 제공
 * - Object URL 메모리 누수 방지를 위한 정리 로직 포함
 * 
 * @param children - Provider로 감쌀 하위 컴포넌트들
 */
export function TrackProvider({ children }: { children: ReactNode }) {
  // 업로드된 오디오 파일 트랙들을 저장하는 상태
  const [tracks, setTracks] = useState<AudioFile[]>([]);

  /**
   * 새로운 트랙을 추가하는 함수
   * 
   * 파일 업로드 시 호출되어 트랙 목록에 새로운 오디오 파일을 추가합니다.
   * useCallback을 사용하여 불필요한 재생성을 방지합니다.
   * 
   * @param file - 추가할 오디오 파일 정보 (AudioFile 타입)
   */
  const addTrack = useCallback((file: AudioFile) => {
    setTracks((prev) => [...prev, file]);
  }, []);

  /**
   * 특정 인덱스의 트랙을 제거하는 함수
   * 
   * 트랙 삭제 시 호출되며, 다음 작업을 수행합니다:
   * 1. 해당 트랙의 Object URL을 해제하여 메모리 누수 방지
   * 2. 트랙 목록에서 해당 항목 제거
   * 
   * @param index - 제거할 트랙의 인덱스 (0부터 시작)
   */
  const removeTrack = useCallback((index: number) => {
    setTracks((prev) => {
      const newTracks = [...prev];
      // Object URL 정리: 브라우저 메모리에서 해제하여 메모리 누수 방지
      if (newTracks[index]?.url) {
        URL.revokeObjectURL(newTracks[index].url);
      }
      // 배열에서 해당 인덱스의 트랙 제거
      newTracks.splice(index, 1);
      return newTracks;
    });
  }, []);

  /**
   * 모든 트랙을 제거하는 함수
   * 
   * 모든 트랙을 삭제할 때 호출되며, 다음 작업을 수행합니다:
   * 1. 모든 트랙의 Object URL을 해제하여 메모리 정리
   * 2. 트랙 목록을 빈 배열로 초기화
   * 
   * tracks 의존성을 포함하여 최신 트랙 목록을 참조합니다.
   */
  const clearTracks = useCallback(() => {
    // 모든 Object URL 정리: 각 트랙의 메모리 해제
    tracks.forEach((track) => {
      if (track.url) {
        URL.revokeObjectURL(track.url);
      }
    });
    // 트랙 목록 초기화
    setTracks([]);
  }, [tracks]);

  // Context Provider를 통해 트랙 관리 기능을 하위 컴포넌트에 제공
  return (
    <TrackContext.Provider value={{ tracks, addTrack, removeTrack, clearTracks }}>
      {children}
    </TrackContext.Provider>
  );
}

/**
 * useTracks 커스텀 훅
 * 
 * TrackContext를 사용하기 위한 편의 훅입니다.
 * TrackProvider 외부에서 사용 시 에러를 발생시켜 잘못된 사용을 방지합니다.
 * 
 * @returns TrackContextValue - 트랙 목록과 관리 함수들을 반환
 * @throws Error - TrackProvider 외부에서 사용 시 에러 발생
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { tracks, addTrack } = useTracks();
 *   // ...
 * }
 * ```
 */
export function useTracks() {
  const context = useContext(TrackContext);
  // TrackProvider로 감싸지지 않은 컴포넌트에서 사용 시 에러 발생
  if (context === undefined) {
    throw new Error('useTracks must be used within a TrackProvider');
  }
  return context;
}

