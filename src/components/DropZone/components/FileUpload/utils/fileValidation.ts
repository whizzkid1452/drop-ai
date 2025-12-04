// 상수 import
import { ACCEPTED_AUDIO_TYPES, MAX_FILE_SIZE, MAX_FILE_SIZE_MB, ERROR_MESSAGES } from '../components/constants';

/**
 * 파일 검증 함수
 * 파일의 형식과 크기를 검증하여 업로드 가능 여부를 확인합니다.
 * 
 * @param file - 검증할 File 객체
 * @returns 검증 실패 시 에러 메시지 문자열, 성공 시 null
 * 
 * @example
 * ```typescript
 * const error = validateFile(file);
 * if (error) {
 *   console.error(error);
 *   return;
 * }
 * // 파일 검증 통과
 * ```
 */
export function validateFile(file: File): string | null {
  // 파일 형식 검증: 허용된 오디오 타입인지 확인
  if (!ACCEPTED_AUDIO_TYPES.includes(file.type as any)) {
    // 지원하지 않는 파일 형식인 경우 에러 메시지 반환
    return ERROR_MESSAGES.UNSUPPORTED_FORMAT;
  }

  // 파일 크기 검증: 최대 크기 제한 확인
  if (file.size > MAX_FILE_SIZE) {
    // 파일 크기가 제한을 초과한 경우 에러 메시지 반환
    return ERROR_MESSAGES.FILE_TOO_LARGE(MAX_FILE_SIZE_MB);
  }

  // 검증 통과: null 반환
  return null;
}


