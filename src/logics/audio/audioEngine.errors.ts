/**
 * AudioEngine 관련 에러 클래스
 *
 * 목적:
 * - 명확한 에러 식별 (에러 코드)
 * - UI에서 적절한 메시지 표시 가능
 * - 에러 핸들링 일관성 확보
 */
export class AudioEngineError extends Error {
  constructor(
    public readonly code: AudioEngineErrorCode,
    message: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AudioEngineError';

    // Error 스택 트레이스 유지
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AudioEngineError);
    }
  }
}

/**
 * 에러 코드 정의
 */
export enum AudioEngineErrorCode {
  /** 트랙 초기화 실패 */
  TRACK_INIT_FAILED = 'TRACK_INIT_FAILED',

  /** 트랙을 찾을 수 없음 */
  TRACK_NOT_FOUND = 'TRACK_NOT_FOUND',

  /** 리전 로드 실패 */
  REGION_LOAD_FAILED = 'REGION_LOAD_FAILED',

  /** Export 실패 */
  EXPORT_FAILED = 'EXPORT_FAILED',

  /** Export 지속 시간이 0 */
  EXPORT_ZERO_DURATION = 'EXPORT_ZERO_DURATION',

  /** Export할 트랙이 없음 */
  EXPORT_NO_TRACKS = 'EXPORT_NO_TRACKS',

  /** 오디오 렌더링 실패 */
  RENDER_FAILED = 'RENDER_FAILED',

  /** Tone.js 컨텍스트 에러 */
  CONTEXT_ERROR = 'CONTEXT_ERROR',
}

/**
 * 에러 코드별 사용자 친화적 메시지
 */
export const ERROR_MESSAGES: Record<AudioEngineErrorCode, string> = {
  [AudioEngineErrorCode.TRACK_INIT_FAILED]: '트랙을 초기화할 수 없습니다.',
  [AudioEngineErrorCode.TRACK_NOT_FOUND]: '트랙을 찾을 수 없습니다.',
  [AudioEngineErrorCode.REGION_LOAD_FAILED]:
    '오디오 파일을 로드할 수 없습니다.',
  [AudioEngineErrorCode.EXPORT_FAILED]: '오디오 내보내기에 실패했습니다.',
  [AudioEngineErrorCode.EXPORT_ZERO_DURATION]:
    '내보낼 오디오의 길이가 0입니다.',
  [AudioEngineErrorCode.EXPORT_NO_TRACKS]: '내보낼 트랙이 없습니다.',
  [AudioEngineErrorCode.RENDER_FAILED]: '오디오 렌더링에 실패했습니다.',
  [AudioEngineErrorCode.CONTEXT_ERROR]: '오디오 컨텍스트 오류가 발생했습니다.',
};

/**
 * 사용자 친화적 에러 메시지 가져오기
 */
export function getUserFriendlyMessage(error: AudioEngineError): string {
  return ERROR_MESSAGES[error.code] || '알 수 없는 오류가 발생했습니다.';
}
