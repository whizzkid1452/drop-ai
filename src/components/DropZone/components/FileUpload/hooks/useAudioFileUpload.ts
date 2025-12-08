// React 훅 import
import { useState, useCallback } from 'react';
// 타입 import
import type { AudioFile } from '../components/types';
// 유틸리티 함수 import
import { getFileDuration } from '../utils/audioMetadata';
import { formatFileSize } from '@/utils/formatFileSize';
// 상수 import
import { ERROR_MESSAGES, MAX_FILE_SIZE, ACCEPTED_AUDIO_TYPES } from '../components/constants';

/**
 * useAudioFileUpload 훅의 옵션 인터페이스
 */
interface UseAudioFileUploadOptions {
  onFileUploaded?: (file: AudioFile) => void; // 파일 업로드 완료 시 호출되는 콜백 함수
}

/**
 * 오디오 파일 업로드 기능을 제공하는 커스텀 훅
 * 파일 검증, 메타데이터 추출, 상태 관리를 담당합니다.
 * 
 * @param options - 훅 옵션 (선택적)
 * @param options.onFileUploaded - 파일 업로드 완료 시 호출되는 콜백 함수
 * @returns 파일 업로드 관련 상태와 함수들
 */
export function useAudioFileUpload({ onFileUploaded }: UseAudioFileUploadOptions = {}) {
  // 업로드된 파일 정보를 저장하는 상태
  const [uploadedFile, setUploadedFile] = useState<AudioFile | null>(null);
  // 에러 메시지를 저장하는 상태
  const [error, setError] = useState<string | null>(null);
  // 파일 처리 중인지 여부를 나타내는 상태
  const [isLoading, setIsLoading] = useState(false);
  // 큰 파일 확인 다이얼로그 상태
  const [isLargeFileDialogOpen, setIsLargeFileDialogOpen] = useState(false);
  // 확인 대기 중인 파일 (100MB 초과)
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  // 확인 대기 중인 파일의 포맷팅된 크기
  const [pendingFileSize, setPendingFileSize] = useState<string>('');

  /**
   * 파일을 실제로 처리하는 내부 함수
   * Object URL 생성 → 메타데이터 추출 → AudioFile 객체 생성
   * 
   * @param file - 처리할 File 객체
   */
  const processFileInternal = useCallback(
    async (file: File) => {
      // 로딩 상태 시작 및 에러 초기화
      setIsLoading(true);
      setError(null);

      // 이전 파일의 Object URL 해제 (메모리 누수 방지)
      if (uploadedFile?.url) {
        URL.revokeObjectURL(uploadedFile.url);
      }

      /* @note whizzkid 추후 스토리지 저장 필요 */ 
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
          formattedSize: formatFileSize(file.size), // 포맷팅된 파일 크기
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
    [onFileUploaded, uploadedFile] // 의존성 배열: onFileUploaded와 uploadedFile이 변경되면 함수 재생성
  );

  /**
   * 파일을 처리하는 메인 함수
   * 파일 크기 확인 → 100MB 초과 시 확인 다이얼로그 표시 → 검증 → 처리
   * 
   * @param file - 처리할 File 객체
   */
  const processFile = useCallback(
    async (file: File) => {
      // 파일 형식 검증 (크기 제외)
      if (!ACCEPTED_AUDIO_TYPES.includes(file.type as any)) {
        setError(ERROR_MESSAGES.UNSUPPORTED_FORMAT);
        return;
      }

      // 100MB 초과 파일인 경우 확인 다이얼로그 표시
      if (file.size > MAX_FILE_SIZE) {
        setPendingFile(file);
        setPendingFileSize(formatFileSize(file.size));
        setIsLargeFileDialogOpen(true);
        return;
      }

      // 100MB 이하 파일은 바로 처리
      await processFileInternal(file);
    },
    [processFileInternal]
  );

  /**
   * 큰 파일 업로드 확인 다이얼로그에서 확인 버튼을 클릭했을 때 호출되는 핸들러
   */
  const handleLargeFileConfirm = useCallback(async () => {
    if (pendingFile) {
      await processFileInternal(pendingFile);
      setPendingFile(null);
      setPendingFileSize('');
    }
  }, [pendingFile, processFileInternal]);

  /**
   * 큰 파일 업로드 확인 다이얼로그에서 취소 버튼을 클릭했을 때 호출되는 핸들러
   */
  const handleLargeFileCancel = useCallback(() => {
    setPendingFile(null);
    setPendingFileSize('');
  }, []);

  /**
   * 상태를 초기화하는 함수
   * 업로드된 파일, 에러, 로딩 상태를 모두 초기화합니다.
   */
  const reset = useCallback(() => {
    // 이전 Object URL 해제
    if (uploadedFile?.url) {
      URL.revokeObjectURL(uploadedFile.url);
    }
    setUploadedFile(null);
    setError(null);
    setIsLoading(false);
  }, [uploadedFile]);

  /**
   * 메모리 누수 방지: cleanup effect 제거
   * 
   * TrackContext에 추가된 파일의 URL은 계속 사용해야 하므로,
   * 컴포넌트 언마운트 시 URL을 revoke하지 않습니다.
   * URL 해제는 TrackContext의 removeTrack/clearTracks에서 처리합니다.
   * 
   * 같은 파일을 다시 업로드할 때의 이전 URL 해제는 processFile 내부에서 처리됩니다.
   */

  // 파일 업로드 관련 상태와 함수들 반환
  return {
    uploadedFile, // 업로드된 파일 정보
    error,        // 에러 메시지
    isLoading,    // 로딩 중인지 여부
    processFile,  // 파일 처리 함수
    reset,        // 상태 초기화 함수
    // 큰 파일 확인 다이얼로그 관련
    isLargeFileDialogOpen,    // 다이얼로그 열림 상태
    setIsLargeFileDialogOpen, // 다이얼로그 열림 상태 변경 함수
    pendingFileSize,          // 확인 대기 중인 파일 크기
    onLargeFileConfirm: handleLargeFileConfirm, // 확인 핸들러
    onLargeFileCancel: handleLargeFileCancel,   // 취소 핸들러
  };
}

