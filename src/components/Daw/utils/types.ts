/**
 * Export 설정 옵션
 * Ardour의 ExportSettings를 참고하여 웹 환경에 맞게 구현
 */
export interface ExportSettings {
  /** 샘플레이트 (Hz), 기본값: 44100 */
  sampleRate?: number;
  /** 비트 깊이 (16, 24, 32, 또는 'float'), 기본값: 16 */
  bitDepth?: 16 | 24 | 32 | 'float';
  /** 정규화 여부, 기본값: false */
  normalize?: boolean;
  /** 출력 파일명 (확장자 제외), 기본값: 'export' */
  filename?: string;
}

/**
 * Export 진행 상태 정보
 */
export interface ExportProgress {
  /** 진행률 (0-100) */
  progress: number;
  /** 현재 단계 설명 */
  stage: 'loading' | 'mixing' | 'encoding' | 'complete';
}

/**
 * WAV 헤더 정보
 */
export interface WavHeaderInfo {
  dataChunkOffset: number;
  totalSize: number;
  dataSize: number;
  bytesPerSample: number;
}

