import { MAX_FILE_SIZE, MAX_FILE_SIZE_MB, ERROR_MESSAGES } from '../components/constants';

// react-dropzone의 accept로 타입 검증은 이미 수행됨.
// 여기서는 크기 초과만 별도 검증한다.

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return ERROR_MESSAGES.FILE_TOO_LARGE(MAX_FILE_SIZE_MB);
  }
  return null;
}

