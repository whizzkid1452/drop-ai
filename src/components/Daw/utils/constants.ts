/** 기본 샘플레이트 (Hz) */
export const DEFAULT_SAMPLE_RATE = 44100;

/** WAV 파일 포맷 상수 */
export const WAV_CONSTANTS = {
  PCM_FMT_CHUNK_SIZE: 16,
  PCM_AUDIO_FORMAT: 1,
} as const;

/** PCM 16-bit 최대값 */
export const PCM_MAX_VALUES = {
  16: 32767,
} as const;

/** 오디오 샘플 범위 제한 */
export const AUDIO_SAMPLE_MIN = -1;
export const AUDIO_SAMPLE_MAX = 1;

