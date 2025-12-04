// React 훅 import
import { useRef, useCallback } from 'react';
// 스타일 import
import * as styles from '../FileUpload.css';
// 상수 import
import { ACCEPTED_AUDIO_TYPES } from './constants';
import { UI_MESSAGES } from './constants';

/**
 * DropHere 컴포넌트의 Props 인터페이스
 */
interface DropHereProps {
  isDragging: boolean;  // 드래그 중인지 여부
  isLoading: boolean;   // 파일 처리 중인지 여부
  onDragEnter: (e: React.DragEvent<HTMLDivElement>) => void;  // 드래그 시작 이벤트 핸들러
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;  // 드래그 종료 이벤트 핸들러
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;   // 드래그 오버 이벤트 핸들러
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;       // 드롭 이벤트 핸들러
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void; // 파일 선택 이벤트 핸들러
}

/**
 * 드래그 앤 드롭 영역을 표시하는 컴포넌트
 * 파일을 드래그하거나 클릭하여 선택할 수 있는 UI를 제공합니다.
 */
export function DropHere({
  isDragging,
  isLoading,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onFileSelect,
}: DropHereProps) {
  // 숨겨진 파일 input 요소에 대한 참조
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * 파일 선택 버튼 클릭 핸들러
   * 숨겨진 input 요소를 클릭하여 파일 선택 다이얼로그를 엽니다.
   */
  const handleButtonClick = useCallback(() => {
    fileInputRef.current?.click(); // 옵셔널 체이닝으로 안전하게 호출
  }, []);

  return (
    <div
      // 드래그 중일 때 활성화 스타일 적용
      className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ''}`}
      onDragEnter={onDragEnter}   // 드래그 시작
      onDragLeave={onDragLeave}   // 드래그 종료
      onDragOver={onDragOver}     // 드래그 오버
      onDrop={onDrop}             // 드롭
      onClick={handleButtonClick} // 클릭 시 파일 선택 다이얼로그 열기
    >
      {/* 숨겨진 파일 input 요소 */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_AUDIO_TYPES.join(',')} // 허용된 오디오 파일 타입만 표시
        onChange={onFileSelect}                 // 파일 선택 시 처리
        className={styles.fileInput}           // 스타일로 숨김 처리
      />
      {/* 드롭 영역 내부 콘텐츠 */}
      <div className={styles.dropZoneContent}>
        {/* 음악 아이콘 */}
        <div className={styles.icon}>🎵</div>
        {/* 제목 (로딩 중이면 "Processing..." 표시) */}
        <h2 className={styles.title}>
          {isLoading ? UI_MESSAGES.TITLE_PROCESSING : UI_MESSAGES.TITLE_UPLOAD}
        </h2>
        {/* 안내 문구 */}
        <p className={styles.subtitle}>{UI_MESSAGES.SUBTITLE}</p>
        {/* 로딩 인디케이터 (로딩 중일 때만 표시) */}
        {isLoading && <div className={styles.loadingIndicator} />}
        {/* 파일 선택 버튼 (로딩 중이 아닐 때만 표시) */}
        {!isLoading && (
          <button
            type="button"
            className={styles.button}
            onClick={(e) => {
              e.stopPropagation(); // 이벤트 버블링 방지
              handleButtonClick(); // 파일 선택 다이얼로그 열기
            }}
          >
            {UI_MESSAGES.BUTTON_SELECT}
          </button>
        )}
      </div>
    </div>
  );
}


