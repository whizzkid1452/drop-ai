// React 훅 import
import { useState, useCallback } from 'react';
// 타입 import
import type { AudioFile } from '../components/types';
// 유틸리티 함수 import
import { validateFile } from '../utils/fileValidation';
import { getFileDuration } from '../utils/audioMetadata';
// 상수 import
import { ERROR_MESSAGES } from '../components/constants';

/**
 * useFileUpload 훅의 옵션 인터페이스
 */
interface UseFileUploadOptions {
  onFileUploaded?: (file: AudioFile) => void; // 파일 업로드 완료 시 호출되는 콜백 함수
}

/**
 * 파일 업로드 기능을 제공하는 커스텀 훅
 * 파일 검증, 메타데이터 추출, 상태 관리를 담당합니다.
 * 
 * @param options - 훅 옵션 (선택적)
 * @param options.onFileUploaded - 파일 업로드 완료 시 호출되는 콜백 함수
 * @returns 파일 업로드 관련 상태와 함수들
 */
export function useFileUpload({ onFileUploaded }: UseFileUploadOptions = {}) {
  // 업로드된 파일 정보를 저장하는 상태
  const [uploadedFile, setUploadedFile] = useState<AudioFile | null>(null);
  // 에러 메시지를 저장하는 상태
  const [error, setError] = useState<string | null>(null);
  // 파일 처리 중인지 여부를 나타내는 상태
  const [isLoading, setIsLoading] = useState(false);

  /**
   * 파일을 처리하는 메인 함수
   * 검증 → Object URL 생성 → 메타데이터 추출 → AudioFile 객체 생성
   * 
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
   * 상태를 초기화하는 함수
   * 업로드된 파일, 에러, 로딩 상태를 모두 초기화합니다.
   */
  const reset = useCallback(() => {
    setUploadedFile(null);
    setError(null);
    setIsLoading(false);
  }, []);

  // 파일 업로드 관련 상태와 함수들 반환
  return {
    uploadedFile, // 업로드된 파일 정보
    error,        // 에러 메시지
    isLoading,    // 로딩 중인지 여부
    processFile,  // 파일 처리 함수
    reset,        // 상태 초기화 함수
  };
}

