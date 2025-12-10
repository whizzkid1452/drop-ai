/**
 * Export 설정 옵션
 */
export interface ExportSettings {
  /** 출력 파일명 (확장자 제외), 기본값: 'export' */
  filename?: string;
}

/**
 * Export 진행 상태 정보
 */
export interface ExportProgress {
  /** 진행률 (0-100) */
  progress: number;
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

