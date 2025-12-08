// React 훅 import
import { useCallback, useMemo } from 'react';
import { useDropzone, type Accept } from 'react-dropzone';
// 스타일 import
import * as styles from '../FileUpload.css';
// 상수 import
import { ACCEPTED_AUDIO_TYPES } from './constants';
import { UI_MESSAGES } from './constants';

/**
 * DropHere 컴포넌트의 Props 인터페이스
 */
interface DropHereProps {
  isLoading: boolean;   // 파일 처리 중인지 여부
  onFileDrop: (file: File) => void; // 파일 드롭/선택 시 처리 핸들러
}

/**
 * 드래그 앤 드롭 영역을 표시하는 컴포넌트
 * 파일을 드래그하거나 클릭하여 선택할 수 있는 UI를 제공합니다.
 */
export function DropHere({
  isLoading,
  onFileDrop,
}: DropHereProps) {
  // dropzone accept 객체 생성
  const accept = useMemo<Accept>(() => {
    return ACCEPTED_AUDIO_TYPES.reduce<Accept>((acc, type) => {
      acc[type] = [];
      return acc;
    }, {});
  }, []);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    open,
  } = useDropzone({
    accept,
    multiple: false,
    disabled: isLoading,
    onDrop: (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        onFileDrop(file);
      }
    },
  });

  /**
   * 파일 선택 버튼 클릭 핸들러
   * 숨겨진 input 요소를 클릭하여 파일 선택 다이얼로그를 엽니다.
   */
  const handleButtonClick = useCallback(() => {
    open();
  }, [open]);

  const dragActive = isDragActive;

  return (
    <div
      {...getRootProps({
        className: `${styles.dropZone} ${dragActive ? styles.dropZoneActive : ''}`,
      })}
    >
      {/* 숨겨진 파일 input 요소 */}
      <input
        {...getInputProps({
          className: styles.fileInput,            // 스타일로 숨김 처리
        })}
      />
      {/* 드롭 영역 내부 콘텐츠 */}
      <div className={styles.dropZoneContent}>
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


