/** 기본 비트 깊이 */
export const DEFAULT_BIT_DEPTH: 16 | 24 | 32 | 'float' = 16;

/** WAV ?�일 ?�맷 ?�수 */
export const WAV_CONSTANTS = {
  RIFF_HEADER_SIZE: 8,
  PCM_FMT_CHUNK_SIZE: 16,
  FLOAT_FMT_CHUNK_SIZE: 18,
  PCM_DATA_CHUNK_OFFSET: 44,
  FLOAT_DATA_CHUNK_OFFSET: 46,
  PCM_AUDIO_FORMAT: 1,
  FLOAT_AUDIO_FORMAT: 3,
  FLOAT_BITS_PER_SAMPLE: 32,
  FLOAT_BYTES_PER_SAMPLE: 4,
} as const;

/** PCM 비트 깊이�?최�?�?*/
export const PCM_MAX_VALUES = {
  16: 32767,
  24: 8388607,
  32: 2147483647,
} as const;

/** 비트 깊이�?바이????*/
export const BYTES_PER_SAMPLE: Record<16 | 24 | 32 | 'float', number> = {
  16: 2,
  24: 3,
  32: 4,
  float: 4,
};

/** ?�디???�플 범위 ?�한 */
export const AUDIO_SAMPLE_MIN = -1;
export const AUDIO_SAMPLE_MAX = 1;
