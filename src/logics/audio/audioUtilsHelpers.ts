import { resampleBuffer } from './audioBufferProcessor';
import type { AudioFile } from '@/components/Daw/components/FileUpload/components/types';

/**
 * 배열을 정규화하는 범용 헬퍼 함수
 * 배열이 undefined이거나 길이가 부족한 경우 기본값으로 채웁니다.
 *
 * @param array - 정규화할 배열
 * @param length - 목표 길이
 * @param defaultValue - 기본값
 * @returns 정규화된 배열
 */
export function normalizeArray<T>(
  array: T[] | undefined,
  length: number,
  defaultValue: T
): T[] {
  const normalized = array ?? Array(length).fill(defaultValue);
  while (normalized.length < length) {
    normalized.push(defaultValue);
  }
  return normalized;
}

/**
 * AudioFile 배열에서 볼륨 배열을 추출하는 헬퍼 함수
 *
 * @param tracks - 오디오 파일 배열
 * @returns 볼륨 배열 (기본값: 1.0)
 */
export function extractVolumesFromTracks(tracks: AudioFile[]): number[] {
  return tracks.map(track => track.volume ?? 1.0);
}

/**
 * AudioFile 배열에서 패닝 배열을 추출하는 헬퍼 함수
 *
 * @param tracks - 오디오 파일 배열
 * @returns 패닝 배열 (기본값: 0.0)
 */
export function extractPansFromTracks(tracks: AudioFile[]): number[] {
  return tracks.map(track => track.pan ?? 0.0);
}

/**
 * 볼륨 배열을 정규화하는 헬퍼 함수
 *
 * @param volumes - 정규화할 볼륨 배열
 * @param bufferCount - 버퍼 개수
 * @returns 정규화된 볼륨 배열 (모든 값이 0.0 ~ 1.0 범위)
 */
export function normalizeVolumeArray(
  volumes: number[] | undefined,
  bufferCount: number
): number[] {
  return normalizeArray(volumes, bufferCount, 1.0);
}

/**
 * 패닝 배열을 정규화하는 헬퍼 함수
 *
 * @param pans - 정규화할 패닝 배열
 * @param bufferCount - 버퍼 개수
 * @returns 정규화된 패닝 배열 (모든 값이 -1.0 ~ 1.0 범위)
 */
export function normalizePanArray(
  pans: number[] | undefined,
  bufferCount: number
): number[] {
  return normalizeArray(pans, bufferCount, 0.0);
}

/**
 * 버퍼 배열에서 최대 길이와 채널 수를 찾는 헬퍼 함수
 *
 * @param audioBuffers - 분석할 오디오 버퍼 배열
 * @returns 최대 길이와 채널 수
 */
export function findMaxDimensions(audioBuffers: AudioBuffer[]): {
  maxLength: number;
  maxChannels: number;
} {
  let maxLength = 0;
  let maxChannels = 1;

  for (const buffer of audioBuffers) {
    maxLength = Math.max(maxLength, buffer.length);
    maxChannels = Math.max(maxChannels, buffer.numberOfChannels);
  }

  return { maxLength, maxChannels };
}

/**
 * 필요한 경우 버퍼를 리샘플링하는 헬퍼 함수
 *
 * @param audioContext - Web Audio API 컨텍스트
 * @param audioBuffers - 리샘플링할 오디오 버퍼 배열
 * @param targetSampleRate - 목표 샘플레이트
 * @returns 리샘플링된 오디오 버퍼 배열
 */
export function resampleBuffersIfNeeded(
  audioContext: AudioContext,
  audioBuffers: AudioBuffer[],
  targetSampleRate: number
): AudioBuffer[] {
  const resampledBuffers: AudioBuffer[] = [];
  for (const buffer of audioBuffers) {
    if (buffer.sampleRate !== targetSampleRate) {
      const resampled = resampleBuffer(audioContext, buffer, targetSampleRate);
      resampledBuffers.push(resampled);
    } else {
      resampledBuffers.push(buffer);
    }
  }
  return resampledBuffers;
}

