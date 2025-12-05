import { ERROR_MESSAGES } from '../components/constants';

/**
 * 오디오 파일의 재생 시간(duration)을 추출하는 함수
 * HTML5 Audio API를 사용하여 파일의 메타데이터를 읽어 재생 시간을 가져옵니다.
 * 
 * @param file - 재생 시간을 추출할 File 객체
 * @returns Promise<number> - 재생 시간(초)을 반환하는 Promise
 * @throws 파일을 읽을 수 없을 때 에러를 던집니다.
 * 
 * @example
 * ```typescript
 * const duration = await getFileDuration(file);
 * console.log(`재생 시간: ${duration}초`);
 * ```
 */
export function getFileDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    // HTML5 Audio 객체 생성
    const audio = new Audio();
    // File 객체로부터 임시 URL 생성 (메모리상의 파일 참조)
    const url = URL.createObjectURL(file);

    /**
     * 메모리 정리 함수
     * Object URL을 해제하여 메모리 누수를 방지합니다.
     */
    const cleanup = () => {
      URL.revokeObjectURL(url);
    };

    // 메타데이터 로드 완료 이벤트 리스너
    audio.addEventListener('loadedmetadata', () => {
      cleanup(); // 메모리 정리
      // 재생 시간 반환 (초 단위)
      resolve(audio.duration);
    });

    // 오디오 로드 실패 이벤트 리스너
    audio.addEventListener('error', () => {
      cleanup(); // 메모리 정리
      // 에러 반환
      reject(new Error(ERROR_MESSAGES.FILE_READ_ERROR));
    });

    // 오디오 소스 설정 (이 시점에 메타데이터 로드 시작)
    audio.src = url;
  });
}


