export class AudioEngineError extends Error {
  constructor(
    public readonly code: AudioEngineErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AudioEngineError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AudioEngineError);
    }
  }
}

export enum AudioEngineErrorCode {
  TRACK_INIT_FAILED = 'TRACK_INIT_FAILED',
  TRACK_NOT_FOUND = 'TRACK_NOT_FOUND',
  PLUGIN_FACTORY_ID_CONFLICT = 'PLUGIN_FACTORY_ID_CONFLICT',
  PLUGIN_FACTORY_NOT_FOUND = 'PLUGIN_FACTORY_NOT_FOUND',
  PLUGIN_INSTANCE_ID_CONFLICT = 'PLUGIN_INSTANCE_ID_CONFLICT',
  PLUGIN_INSTANCE_NOT_FOUND = 'PLUGIN_INSTANCE_NOT_FOUND',
  PLUGIN_TARGET_INDEX_OUT_OF_RANGE = 'PLUGIN_TARGET_INDEX_OUT_OF_RANGE',
  PLUGIN_RUNTIME_CREATE_FAILED = 'PLUGIN_RUNTIME_CREATE_FAILED',
  PLUGIN_CHAIN_UPDATE_FAILED = 'PLUGIN_CHAIN_UPDATE_FAILED',
  PLUGIN_PARAMETER_UPDATE_FAILED = 'PLUGIN_PARAMETER_UPDATE_FAILED',
  REGION_LOAD_FAILED = 'REGION_LOAD_FAILED',
  REGION_NOT_FOUND = 'REGION_NOT_FOUND',
  REGION_ID_CONFLICT = 'REGION_ID_CONFLICT',
  REGION_SCHEDULE_FAILED = 'REGION_SCHEDULE_FAILED',
  REGION_STATE_CHANGED = 'REGION_STATE_CHANGED',
  ACTIVE_GRAPH_CHANGED = 'ACTIVE_GRAPH_CHANGED',
  PROJECT_GRAPH_ACTIVATION_FAILED = 'PROJECT_GRAPH_ACTIVATION_FAILED',
  PROJECT_RUNTIME_RECOVERY_PENDING = 'PROJECT_RUNTIME_RECOVERY_PENDING',
  EXPORT_FAILED = 'EXPORT_FAILED',
  EXPORT_ZERO_DURATION = 'EXPORT_ZERO_DURATION',
  EXPORT_NO_TRACKS = 'EXPORT_NO_TRACKS',
  RENDER_FAILED = 'RENDER_FAILED',
  CONTEXT_ERROR = 'CONTEXT_ERROR',
}

export const ERROR_MESSAGES: Record<AudioEngineErrorCode, string> = {
  [AudioEngineErrorCode.TRACK_INIT_FAILED]: '트랙을 초기화할 수 없습니다.',
  [AudioEngineErrorCode.TRACK_NOT_FOUND]: '트랙을 찾을 수 없습니다.',
  [AudioEngineErrorCode.PLUGIN_FACTORY_ID_CONFLICT]: '플러그인 오디오 팩토리 ID가 중복되었습니다.',
  [AudioEngineErrorCode.PLUGIN_FACTORY_NOT_FOUND]: '플러그인 오디오 팩토리를 찾을 수 없습니다.',
  [AudioEngineErrorCode.PLUGIN_INSTANCE_ID_CONFLICT]: '플러그인 인스턴스 ID가 이미 사용 중입니다.',
  [AudioEngineErrorCode.PLUGIN_INSTANCE_NOT_FOUND]: '플러그인 인스턴스를 찾을 수 없습니다.',
  [AudioEngineErrorCode.PLUGIN_TARGET_INDEX_OUT_OF_RANGE]: '플러그인 대상 순서가 범위를 벗어났습니다.',
  [AudioEngineErrorCode.PLUGIN_RUNTIME_CREATE_FAILED]: '플러그인 오디오 런타임을 만들 수 없습니다.',
  [AudioEngineErrorCode.PLUGIN_CHAIN_UPDATE_FAILED]: '플러그인 오디오 체인을 변경할 수 없습니다.',
  [AudioEngineErrorCode.PLUGIN_PARAMETER_UPDATE_FAILED]: '플러그인 매개변수를 변경할 수 없습니다.',
  [AudioEngineErrorCode.REGION_LOAD_FAILED]: '오디오 파일을 로드할 수 없습니다.',
  [AudioEngineErrorCode.REGION_NOT_FOUND]: '리전을 찾을 수 없습니다.',
  [AudioEngineErrorCode.REGION_ID_CONFLICT]: '리전 ID가 이미 사용 중입니다.',
  [AudioEngineErrorCode.REGION_SCHEDULE_FAILED]: '리전 재생 시간을 예약할 수 없습니다.',
  [AudioEngineErrorCode.REGION_STATE_CHANGED]: '리전 작업 중 상태가 변경되었습니다.',
  [AudioEngineErrorCode.ACTIVE_GRAPH_CHANGED]: '프로젝트 준비 중 활성 오디오 그래프가 변경되었습니다.',
  [AudioEngineErrorCode.PROJECT_GRAPH_ACTIVATION_FAILED]: '준비한 프로젝트 오디오 그래프를 활성화하지 못했습니다.',
  [AudioEngineErrorCode.PROJECT_RUNTIME_RECOVERY_PENDING]: '이전 프로젝트 오디오 상태를 복원하고 있습니다.',
  [AudioEngineErrorCode.EXPORT_FAILED]: '오디오 내보내기에 실패했습니다.',
  [AudioEngineErrorCode.EXPORT_ZERO_DURATION]: '내보낼 오디오의 길이가 0입니다.',
  [AudioEngineErrorCode.EXPORT_NO_TRACKS]: '내보낼 트랙이 없습니다.',
  [AudioEngineErrorCode.RENDER_FAILED]: '오디오 렌더링에 실패했습니다.',
  [AudioEngineErrorCode.CONTEXT_ERROR]: '오디오 컨텍스트 오류가 발생했습니다.',
};

export function getUserFriendlyMessage(error: AudioEngineError): string {
  return ERROR_MESSAGES[error.code] || '알 수 없는 오류가 발생했습니다.';
}
