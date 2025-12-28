import {
  AUDIO_SAMPLE_MAX,
  AUDIO_SAMPLE_MIN,
} from '../../components/Daw/components/ExportButton/constants';

/**
 * 오디오 샘플 값을 [-1, 1] 범위로 제한
 */
export function clampSample(value: number): number {
  return Math.max(AUDIO_SAMPLE_MIN, Math.min(AUDIO_SAMPLE_MAX, value));
}
