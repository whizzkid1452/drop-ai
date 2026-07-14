/**
 * Export ?�정 ?�션
 * Ardour??ExportSettings�?참고?�여 ???�경??맞게 구현
 */
export interface ExportSettings {
  /** ?�플?�이??(Hz), 기본�? 44100 */
  sampleRate?: number;
  /** 비트 깊이 (16, 24, 32, ?�는 'float'), 기본�? 16 */
  bitDepth?: 16 | 24 | 32 | 'float';
  /** ?�규???��?, 기본�? false */
  normalize?: boolean;
  /** 출력 ?�일�?(?�장???�외), 기본�? 'export' */
  filename?: string;
}

/**
 * Export 진행 ?�태 ?�보
 */
export interface ExportProgress {
  /** 진행�?(0-100) */
  progress: number;
  /** ?�재 ?�계 ?�명 */
  stage: 'loading' | 'mixing' | 'encoding' | 'complete';
}

/**
 * WAV ?�더 ?�보
 */
export interface WavHeaderInfo {
  dataChunkOffset: number;
  totalSize: number;
  dataSize: number;
  bytesPerSample: number;
}
