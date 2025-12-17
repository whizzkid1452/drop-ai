/**
 * Canvas 파형 시각화 설정
 */
export const WAVEFORM_CONFIG = {
  height: 120,
  waveColor: '#3a7bfd',
  progressColor: '#8fb2ff',
  cursorColor: '#ffcc66',
  barWidth: 2,
  barGap: 1,
  barRadius: 2,
  normalize: true,
} as const;

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
