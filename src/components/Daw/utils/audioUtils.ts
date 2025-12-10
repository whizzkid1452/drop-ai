import type { AudioFile } from '@/components/DropZone/components/FileUpload/components/types';
import { AUDIO_SAMPLE_MIN, AUDIO_SAMPLE_MAX } from './constants';

//클리핑 방지: 오버플로우 방지를 위해 오디오 샘플 값을 [-1, 1] 범위로 제한

export function clampSample(value: number): number {
  return Math.max(AUDIO_SAMPLE_MIN, Math.min(AUDIO_SAMPLE_MAX, value));
}

//오디오 파일을 ArrayBuffer로 로드하는 함수

export async function loadAudioFile(audioFile: AudioFile): Promise<ArrayBuffer> {
  const response = await fetch(audioFile.url);
  if (!response.ok) {
    throw new Error(`Failed to load audio file: ${audioFile.name}`);
  }
  return response.arrayBuffer();
}

//오디오 버퍼를 리샘플링하는 함수 (간단한 선형 보간)

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

//여러 오디오 버퍼를 하나로 믹싱하는 함수

export async function mixAudioBuffers(
  audioContext: AudioContext,
  audioBuffers: AudioBuffer[],
  targetSampleRate: number
): Promise<AudioBuffer> {
  if (audioBuffers.length === 0) {
    throw new Error('No audio buffers to mix');
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

  // 모든 버퍼를 믹싱
  for (const buffer of resampledBuffers) {
    for (let channel = 0; channel < maxChannels; channel++) {
      const mixedChannel = mixedBuffer.getChannelData(channel);
      const sourceChannel = buffer.getChannelData(
        Math.min(channel, buffer.numberOfChannels - 1)
      );

      for (let i = 0; i < sourceChannel.length; i++) {
        mixedChannel[i] += sourceChannel[i];
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

