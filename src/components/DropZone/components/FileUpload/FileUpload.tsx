// React 훅 import
import { useState, useRef, useCallback } from 'react';
// 스타일 import
import * as styles from './FileUpload.css';
// 타입 import
import type { AudioFile, FileUploadProps } from './components/types';
// 상수 import
import { ACCEPTED_AUDIO_TYPES, ERROR_MESSAGES, UI_MESSAGES } from './components/constants';
// 유틸리티 함수 import
import { validateFile } from './utils/fileValidation';
import { getFileDuration } from './utils/audioMetadata';

/**
 * 음원 파일 업로드 컴포넌트
 * 드래그 앤 드롭과 파일 선택 다이얼로그를 지원합니다.
 */
export function FileUpload({ onFileUploaded }: FileUploadProps) {
  // 드래그 중인지 여부를 나타내는 상태
  const [isDragging, setIsDragging] = useState(false);
  // 업로드된 파일 정보를 저장하는 상태
  const [uploadedFile, setUploadedFile] = useState<AudioFile | null>(null);
  // 에러 메시지를 저장하는 상태
  const [error, setError] = useState<string | null>(null);
  // 파일 처리 중인지 여부를 나타내는 상태
  const [isLoading, setIsLoading] = useState(false);
  // 숨겨진 파일 input 요소에 대한 참조
  const fileInputRef = useRef<HTMLInputElement>(null);


  /**
   * 파일을 처리하는 메인 함수
   * 검증 → Object URL 생성 → 메타데이터 추출 → AudioFile 객체 생성
   * @param file - 처리할 File 객체
   */
  const processFile = useCallback(
    async (file: File) => {
      // 로딩 상태 시작 및 에러 초기화
      setIsLoading(true);
      setError(null);

      // 파일 검증 (형식, 크기)
      const validationError = validateFile(file);
      if (validationError) {
        // 검증 실패 시 에러 메시지 설정하고 종료
        setError(validationError);
        setIsLoading(false);
        return;
      }

      try {
        // File 객체로부터 Object URL 생성 (브라우저 메모리상의 임시 URL)
        const url = URL.createObjectURL(file);
        // 재생 시간 변수 (선택적)
        let duration: number | undefined;

        // 재생 시간 추출 시도 (실패해도 계속 진행)
        try {
          duration = await getFileDuration(file);
        } catch (err) {
          // 재생 시간 추출 실패는 경고만 출력하고 계속 진행
          console.warn('Unable to get file duration:', err);
        }

        // AudioFile 객체 생성 (구조화된 파일 정보)
        const audioFile: AudioFile = {
          file,           // 원본 File 객체
          name: file.name, // 파일명
          size: file.size, // 파일 크기
          type: file.type, // MIME 타입
          duration,       // 재생 시간 (초)
          url,            // Object URL (미리보기용)
        };

        // 업로드된 파일 상태 업데이트
        setUploadedFile(audioFile);
        // 부모 컴포넌트에 콜백 전달 (옵셔널 체이닝 사용)
        onFileUploaded?.(audioFile);
      } catch (err) {
        // 예외 발생 시 에러 메시지 설정
        setError(ERROR_MESSAGES.PROCESSING_ERROR);
        console.error(err);
      } finally {
        // 성공/실패 여부와 관계없이 로딩 상태 종료
        setIsLoading(false);
      }
    },
    [onFileUploaded] // 의존성 배열: onFileUploaded가 변경되면 함수 재생성
  );

  /**
   * 드래그 시작 이벤트 핸들러
   * 파일을 드래그 영역에 들어올 때 호출됨
   */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();      // 기본 동작 방지
    e.stopPropagation();    // 이벤트 버블링 방지
    setIsDragging(true);    // 드래그 중 상태로 변경
  }, []);

  /**
   * 드래그 종료 이벤트 핸들러
   * 파일을 드래그 영역에서 벗어날 때 호출됨
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();      // 기본 동작 방지
    e.stopPropagation();    // 이벤트 버블링 방지
    setIsDragging(false);   // 드래그 중 상태 해제
  }, []);

  /**
   * 드래그 오버 이벤트 핸들러
   * 파일을 드래그 영역 위에서 움직일 때 호출됨
   * 드롭을 허용하기 위해 기본 동작을 방지해야 함
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();      // 기본 동작 방지 (드롭 허용)
    e.stopPropagation();    // 이벤트 버블링 방지
  }, []);

  /**
   * 드롭 이벤트 핸들러
   * 파일을 드래그 영역에 놓을 때 호출됨
   */
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();      // 기본 동작 방지 (파일이 브라우저에서 열리는 것 방지)
      e.stopPropagation();    // 이벤트 버블링 방지
      setIsDragging(false);   // 드래그 중 상태 해제

      // 드롭된 파일 목록을 배열로 변환
      const files = Array.from(e.dataTransfer.files);
      // 첫 번째 파일만 처리 (다중 파일 미지원)
      if (files.length > 0) {
        await processFile(files[0]);
      }
    },
    [processFile] // 의존성 배열
  );

  /**
   * 파일 선택 다이얼로그에서 파일을 선택했을 때 호출되는 핸들러
   */
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      // 선택된 파일 목록 가져오기
      const files = e.target.files;
      // 파일이 선택되었으면 첫 번째 파일 처리
      if (files && files.length > 0) {
        await processFile(files[0]);
      }
    },
    [processFile] // 의존성 배열
  );

  /**
   * 파일 선택 버튼 클릭 핸들러
   * 숨겨진 input 요소를 클릭하여 파일 선택 다이얼로그 열기
   */
  const handleButtonClick = useCallback(() => {
    fileInputRef.current?.click(); // 옵셔널 체이닝으로 안전하게 호출
  }, []);

  return (
    <div className={styles.container}>
      {/* 드래그 앤 드롭 영역 */}
      <div
        className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ''}`}
        onDragEnter={handleDragEnter}   // 드래그 시작
        onDragLeave={handleDragLeave}   // 드래그 종료
        onDragOver={handleDragOver}     // 드래그 오버
        onDrop={handleDrop}             // 드롭
        onClick={handleButtonClick}     // 클릭 시 파일 선택 다이얼로그 열기
      >
        {/* 숨겨진 파일 input 요소 */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_AUDIO_TYPES.join(',')} // 허용된 파일 타입만 표시
          onChange={handleFileSelect}            // 파일 선택 시 처리
          className={styles.fileInput}           // 스타일로 숨김 처리
        />
        {/* 드롭 영역 내부 콘텐츠 */}
        <div className={styles.dropZoneContent}>
          {/* 아이콘 */}
          <div className={styles.icon}>🎵</div>
          {/* 제목 (로딩 중이면 "파일 처리 중..." 표시) */}
          <h2 className={styles.title}>
            {isLoading ? UI_MESSAGES.TITLE_PROCESSING : UI_MESSAGES.TITLE_UPLOAD}
          </h2>
          {/* 안내 문구 */}
          <p className={styles.subtitle}>
            {UI_MESSAGES.SUBTITLE}
          </p>
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

      {/* 에러 메시지 표시 (에러가 있을 때만 표시) */}
      {error && <div className={styles.errorMessage}>{error}</div>}

      {/* 오디오 미리보기 플레이어 (파일이 업로드되었을 때만 표시) */}
      {uploadedFile && (
        <audio
          src={uploadedFile.url}  // Object URL 사용
          controls                // 브라우저 기본 컨트롤 표시
          className={styles.audioPreview}
        />
      )}
    </div>
  );
}

