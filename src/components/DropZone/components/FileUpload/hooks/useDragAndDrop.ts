// React 훅 import
import { useState, useCallback } from 'react';

/**
 * useDragAndDrop 훅의 옵션 인터페이스
 */
interface UseDragAndDropOptions {
  onDrop: (file: File) => void; // 파일이 드롭되었을 때 호출되는 콜백 함수
}

/**
 * 드래그 앤 드롭 기능을 제공하는 커스텀 훅
 * 파일을 드래그하여 드롭할 수 있는 기능과 관련된 상태 및 이벤트 핸들러를 제공합니다.
 * 
 * @param options - 훅 옵션
 * @param options.onDrop - 파일이 드롭되었을 때 호출되는 콜백 함수
 * @returns 드래그 앤 드롭 관련 상태와 이벤트 핸들러
 */
export function useDragAndDrop({ onDrop }: UseDragAndDropOptions) {
  // 드래그 중인지 여부를 나타내는 상태
  const [isDragging, setIsDragging] = useState(false);

  /**
   * 드래그 시작 이벤트 핸들러
   * 파일을 드래그 영역에 들어올 때 호출됩니다.
   * 
   * @param e - 드래그 이벤트 객체
   */
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();      // 기본 동작 방지
    e.stopPropagation();    // 이벤트 버블링 방지
    setIsDragging(true);    // 드래그 중 상태로 변경
  }, []);

  /**
   * 드래그 종료 이벤트 핸들러
   * 파일을 드래그 영역에서 벗어날 때 호출됩니다.
   * 
   * @param e - 드래그 이벤트 객체
   */
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();      // 기본 동작 방지
    e.stopPropagation();    // 이벤트 버블링 방지
    setIsDragging(false);   // 드래그 중 상태 해제
  }, []);

  /**
   * 드래그 오버 이벤트 핸들러
   * 파일을 드래그 영역 위에서 움직일 때 호출됩니다.
   * 드롭을 허용하기 위해 기본 동작을 방지해야 합니다.
   * 
   * @param e - 드래그 이벤트 객체
   */
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();      // 기본 동작 방지 (드롭 허용)
    e.stopPropagation();    // 이벤트 버블링 방지
  }, []);

  /**
   * 드롭 이벤트 핸들러
   * 파일을 드래그 영역에 놓을 때 호출됩니다.
   * 
   * @param e - 드래그 이벤트 객체
   */
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();      // 기본 동작 방지 (파일이 브라우저에서 열리는 것 방지)
      e.stopPropagation();    // 이벤트 버블링 방지
      setIsDragging(false);   // 드래그 중 상태 해제

      // 드롭된 파일 목록을 배열로 변환
      const files = Array.from(e.dataTransfer.files);
      // 첫 번째 파일만 처리 (다중 파일 미지원)
      if (files.length > 0) {
        onDrop(files[0]);
      }
    },
    [onDrop] // 의존성 배열: onDrop이 변경되면 함수 재생성
  );

  // 드래그 앤 드롭 관련 상태와 이벤트 핸들러 반환
  return {
    isDragging,      // 드래그 중인지 여부
    handleDragEnter, // 드래그 시작 핸들러
    handleDragLeave, // 드래그 종료 핸들러
    handleDragOver,  // 드래그 오버 핸들러
    handleDrop,      // 드롭 핸들러
  };
}

