import type { AudioFile } from '@/components/Daw/components/FileUpload/components/types';
import {
  AUDIO_SAMPLE_MIN,
  AUDIO_SAMPLE_MAX,
} from '../../components/Daw/components/ExportButton/constants';

/**
 * 오디오 샘플 값을 [-1, 1] 범위로 제한
 */
export function clampSample(value: number): number {
  return Math.max(AUDIO_SAMPLE_MIN, Math.min(AUDIO_SAMPLE_MAX, value));
}

/**
 * 오디오 파일을 ArrayBuffer로 로드하는 함수
 *
 * @param audioFile - 로드할 오디오 파일
 * @returns Promise<ArrayBuffer> - 오디오 데이터
 * @throws {Error} 파일 로드 실패 시
 */
export async function loadAudioFile(
  audioFile: AudioFile
): Promise<ArrayBuffer> {
  const response = await fetch(audioFile.url);
  if (!response.ok) {
    throw new Error(`Failed to load audio file: ${audioFile.name}`);
  }
  return response.arrayBuffer();
}

/**
 * 오디오 버퍼를 정규화하는 함수
 *
 * @param audioContext - Web Audio API 컨텍스트
 * @param audioBuffer - 정규화할 오디오 버퍼
 * @returns 정규화된 오디오 버퍼 (새로운 AudioBuffer)
 */
export function normalizeAudioBuffer(
  audioContext: AudioContext,
  audioBuffer: AudioBuffer
): AudioBuffer {
  let maxValue = 0;

  // 모든 채널의 최대값 찾기 (불필요한 배열 복사 제거)
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const data = audioBuffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      maxValue = Math.max(maxValue, Math.abs(data[i]));
    }
  }

  // 최대값이 0이면 정규화 불필요
  if (maxValue === 0 || maxValue >= 1.0) {
    return audioBuffer;
  }

  // 정규화 계수 계산 (0dBFS로 정규화)
  const normalizationFactor = 1.0 / maxValue;

  // 새로운 버퍼 생성
  const normalizedBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  // 정규화 적용
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const outputData = normalizedBuffer.getChannelData(channel);
    for (let i = 0; i < inputData.length; i++) {
      outputData[i] = inputData[i] * normalizationFactor;
    }
  }

  return normalizedBuffer;
}

/**
 * 오디오 버퍼를 리샘플링하는 함수 (간단한 선형 보간)
 *
 * @param audioContext - Web Audio API 컨텍스트
 * @param audioBuffer - 리샘플링할 오디오 버퍼
 * @param targetSampleRate - 목표 샘플레이트
 * @returns 리샘플링된 오디오 버퍼
 */
export function resampleBuffer(
  audioContext: AudioContext,
  audioBuffer: AudioBuffer,
  targetSampleRate: number
): AudioBuffer {
  const ratio = targetSampleRate / audioBuffer.sampleRate;
  const newLength = Math.ceil(audioBuffer.length * ratio);
  const newBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    newLength,
    targetSampleRate
  );

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const outputData = newBuffer.getChannelData(channel);

    for (let i = 0; i < newLength; i++) {
      const srcIndex = i / ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, inputData.length - 1);
      const t = srcIndex - srcIndexFloor;

      // 선형 보간
      outputData[i] =
        inputData[srcIndexFloor] * (1 - t) + inputData[srcIndexCeil] * t;
    }
  }

  return newBuffer;
}

/**
 * 여러 오디오 버퍼를 하나로 믹싱하는 함수
 *
 * @param audioContext - Web Audio API 컨텍스트
 * @param audioBuffers - 믹싱할 오디오 버퍼 배열
 * @param targetSampleRate - 목표 샘플레이트
 * @param volumes - 각 버퍼에 적용할 볼륨 레벨 배열 (0.0 ~ 1.0, 기본값: 1.0)
 * @returns Promise<AudioBuffer> - 믹싱된 오디오 버퍼
 * @throws {Error} 버퍼가 없을 경우
 */
export async function mixAudioBuffers(
  audioContext: AudioContext,
  audioBuffers: AudioBuffer[],
  targetSampleRate: number,
  volumes?: number[]
): Promise<AudioBuffer> {
  if (audioBuffers.length === 0) {
    throw new Error('No audio buffers to mix');
  }

  // 볼륨 배열이 제공되지 않으면 모든 버퍼에 1.0 적용
  const normalizedVolumes = volumes ?? audioBuffers.map(() => 1.0);

  // 볼륨 배열 길이가 버퍼 배열과 다르면 기본값 1.0으로 채움
  while (normalizedVolumes.length < audioBuffers.length) {
    normalizedVolumes.push(1.0);
  }

  // 가장 긴 길이와 최대 채널 수 찾기
  let maxLength = 0;
  let maxChannels = 1;

  for (const buffer of audioBuffers) {
    maxLength = Math.max(maxLength, buffer.length);
    maxChannels = Math.max(maxChannels, buffer.numberOfChannels);
  }

  // 리샘플링이 필요한 경우 처리
  const resampledBuffers: AudioBuffer[] = [];
  for (const buffer of audioBuffers) {
    if (buffer.sampleRate !== targetSampleRate) {
      const resampled = resampleBuffer(audioContext, buffer, targetSampleRate);
      resampledBuffers.push(resampled);
    } else {
      resampledBuffers.push(buffer);
    }
  }

  // 믹싱된 버퍼 생성
  const mixedBuffer = audioContext.createBuffer(
    maxChannels,
    Math.ceil(maxLength),
    targetSampleRate
  );

  // 모든 버퍼를 볼륨과 함께 믹싱
  for (
    let bufferIndex = 0;
    bufferIndex < resampledBuffers.length;
    bufferIndex++
  ) {
    const buffer = resampledBuffers[bufferIndex];
    const volume = Math.max(
      0,
      Math.min(1, normalizedVolumes[bufferIndex] ?? 1.0)
    );

    for (let channel = 0; channel < maxChannels; channel++) {
      const mixedChannel = mixedBuffer.getChannelData(channel);
      const sourceChannel = buffer.getChannelData(
        Math.min(channel, buffer.numberOfChannels - 1)
      );

      for (let i = 0; i < sourceChannel.length; i++) {
        mixedChannel[i] += sourceChannel[i] * volume;
      }
    }
  }

  // 클리핑 방지 (오버플로우 방지)
  for (let channel = 0; channel < maxChannels; channel++) {
    const channelData = mixedBuffer.getChannelData(channel);
    for (let i = 0; i < channelData.length; i++) {
      channelData[i] = clampSample(channelData[i]);
    }
  }

  return mixedBuffer;
}

export async function loadAndDecodeAudioFiles({
  audioContext,
  audioFiles,
  onProgress,
}: {
  audioContext: AudioContext;
  audioFiles: AudioFile[];
  onProgress?: (progress: number) => void;
}): Promise<AudioBuffer[]> {
  const decodedAudioBuffers: AudioBuffer[] = [];
  const totalTracks = audioFiles.length;

  for (let i = 0; i < audioFiles.length; i++) {
    const track = audioFiles[i];
    const progress = (i / totalTracks) * 50;
    onProgress?.(progress);

    try {
      const arrayBuffer = await loadAudioFile(track);

      const decodedAudioBuffer =
        await audioContext.decodeAudioData(arrayBuffer);
      decodedAudioBuffers.push(decodedAudioBuffer);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to load track: ${track.name}`, error);
      throw new Error(`Failed to load track "${track.name}": ${errorMessage}`);
    }
  }

  return decodedAudioBuffers;
}
