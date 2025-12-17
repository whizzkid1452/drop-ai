/**
 * 오디오 처리 관련 상수 정의
 */

/** 기본 샘플레이트 (Hz) */
export const DEFAULT_SAMPLE_RATE = 44100;

/**
 * 볼륨 범위
 */
export const VOLUME_RANGE = {
  MIN: 0,
  MAX: 1,
} as const;

/**
 * 패닝 범위
 */
export const PAN_RANGE = {
  MIN: -1,
  MAX: 1,
} as const;

