import { AudioEngineError, getUserFriendlyMessage } from './audioEngine.errors';

/**
 * AudioEngine 관련 에러를 UI에서 처리하는 공통 핸들러
 * 
 * 역할:
 * - 에러 타입에 따른 사용자 알림 (alert)
 * - 상세 에러 로깅 (console.error)
 * 
 * @param error - 처리할 에러 객체
 */
export function handleAudioEngineError(error: unknown): void {
  if (error instanceof AudioEngineError) {
    const friendlyMessage = getUserFriendlyMessage(error);
    
    // UI 알림
    alert(friendlyMessage);
    
    // 개발자 로깅
    console.error('[AudioEngine Error]', {
      code: error.code,
      message: error.message,
      details: error.details,
    });
  } else {
    // 일반 에러 처리
    alert('알 수 없는 오류가 발생했습니다.');
    console.error('[Unknown Error]', error);
  }
}
