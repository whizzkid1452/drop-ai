/** 오디오 샘플 범위 제한 */
const AUDIO_SAMPLE_MIN = -1;
const AUDIO_SAMPLE_MAX = 1;

/**
 * 오디오 샘플 값을 [-1, 1] 범위로 제한
 *
 * @param value - 제한할 샘플 값
 * @returns 제한된 샘플 값
 */
export function clampSample(value: number): number {
  return Math.max(AUDIO_SAMPLE_MIN, Math.min(AUDIO_SAMPLE_MAX, value));
}

/**
 * 오디오 버퍼를 정규화하는 함수
 * 모든 채널의 최대값을 찾아 0dBFS로 정규화합니다.
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

  // 모든 채널의 최대값 찾기
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const data = audioBuffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      maxValue = Math.max(maxValue, Math.abs(data[i]));
    }
  }

  // 최대값이 0이거나 이미 1.0 이상이면 정규화 불필요
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
 * 오디오 버퍼를 리샘플링하는 함수 (선형 보간 사용)
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
