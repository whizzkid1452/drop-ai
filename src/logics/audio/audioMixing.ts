import { resampleBuffer } from './audioBufferProcessor';

/**
 * 여러 오디오 버퍼를 하나로 믹싱하는 함수
 * Web Audio API의 OfflineAudioContext, GainNode, StereoPannerNode를 사용하여
 * 볼륨과 패닝을 적용하여 모든 버퍼를 하나의 스테레오 버퍼로 합칩니다.
 *
 * @param audioContext - Web Audio API 컨텍스트 (리샘플링용)
 * @param audioBuffers - 믹싱할 오디오 버퍼 배열
 * @param targetSampleRate - 목표 샘플레이트
 * @param volumes - 각 버퍼에 적용할 볼륨 레벨 배열 (0.0 ~ 1.0, 기본값: 1.0)
 * @param pans - 각 버퍼에 적용할 패닝 레벨 배열 (-1.0 ~ 1.0, 기본값: 0.0)
 * @returns Promise<AudioBuffer> - 믹싱된 오디오 버퍼
 * @throws {Error} 버퍼가 없을 경우
 */
export async function mixAudioBuffers(
  audioContext: AudioContext,
  audioBuffers: AudioBuffer[],
  targetSampleRate: number,
  volumes?: number[],
  pans?: number[]
): Promise<AudioBuffer> {
  if (audioBuffers.length === 0) {
    throw new Error('No audio buffers to mix');
  }

  // 볼륨 배열 정규화
  const normalizedVolumes = normalizeVolumeArray(volumes, audioBuffers.length);

  // 패닝 배열 정규화
  const normalizedPans = normalizePanArray(pans, audioBuffers.length);

  // 가장 긴 길이와 최대 채널 수 찾기
  const { maxLength, maxChannels } = findMaxDimensions(audioBuffers);

  // 리샘플링이 필요한 경우 처리
  const resampledBuffers = resampleBuffersIfNeeded(
    audioContext,
    audioBuffers,
    targetSampleRate
  );

  // OfflineAudioContext 생성 (오프라인 렌더링용)
  const offlineContext = new OfflineAudioContext(
    maxChannels,
    Math.ceil(maxLength),
    targetSampleRate
  );

  // 각 버퍼에 대해 오디오 그래프 생성 및 연결
  for (let i = 0; i < resampledBuffers.length; i++) {
    const buffer = resampledBuffers[i];
    const volume = Math.max(0, Math.min(1, normalizedVolumes[i] ?? 1.0));
    const pan = normalizedPans[i] ?? 0.0;

    // AudioBufferSourceNode 생성
    const source = offlineContext.createBufferSource();
    source.buffer = buffer;

    // GainNode 생성 (볼륨 제어)
    const gainNode = offlineContext.createGain();
    gainNode.gain.value = volume;

    // StereoPannerNode 생성 (패닝 제어)
    const pannerNode = offlineContext.createStereoPanner();
    pannerNode.pan.value = pan;

    // 오디오 그래프 연결: source -> gain -> panner -> destination
    source.connect(gainNode);
    gainNode.connect(pannerNode);
    pannerNode.connect(offlineContext.destination);

    // 재생 시작
    source.start(0);
  }

  // 오프라인 렌더링 실행
  const renderedBuffer = await offlineContext.startRendering();

  return renderedBuffer;
}

/**
 * 볼륨 배열을 정규화하는 헬퍼 함수
 */
function normalizeVolumeArray(
  volumes: number[] | undefined,
  bufferCount: number
): number[] {
  const normalized = volumes ?? Array(bufferCount).fill(1.0);
  while (normalized.length < bufferCount) {
    normalized.push(1.0);
  }
  return normalized;
}

/**
 * 패닝 배열을 정규화하는 헬퍼 함수
 */
function normalizePanArray(
  pans: number[] | undefined,
  bufferCount: number
): number[] {
  const normalized = pans ?? Array(bufferCount).fill(0.0);
  while (normalized.length < bufferCount) {
    normalized.push(0.0);
  }
  return normalized;
}

/**
 * 버퍼 배열에서 최대 길이와 채널 수를 찾는 헬퍼 함수
 */
function findMaxDimensions(audioBuffers: AudioBuffer[]): {
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
 */
function resampleBuffersIfNeeded(
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

