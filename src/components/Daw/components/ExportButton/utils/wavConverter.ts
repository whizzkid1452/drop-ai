import {
  WAV_CONSTANTS,
  BYTES_PER_SAMPLE,
  PCM_MAX_VALUES,
  DEFAULT_BIT_DEPTH,
} from '../constants';
import { clampSample } from '../../../../../logics/audio/audioUtils';
import type { WavHeaderInfo } from '../types';

/**
 * WAV 헤더 정보 계산
 *
 * WAV 파일 구조:
 * - RIFF 헤더: 12 bytes ('RIFF' + size + 'WAVE')
 * - fmt chunk: 24 bytes (PCM) or 26 bytes (Float) ('fmt ' + size + data)
 * - data chunk: 8 bytes + dataSize ('data' + size + audio data)
 */
export function calculateWavHeaderInfo(
  audioBuffer: AudioBuffer,
  bitDepth: 16 | 24 | 32 | 'float'
): WavHeaderInfo {
  const bytesPerSample = BYTES_PER_SAMPLE[bitDepth];
  const dataSize =
    audioBuffer.length * audioBuffer.numberOfChannels * bytesPerSample;

  // fmt chunk 크기: 'fmt ' (4) + size (4) + data (16 or 18)
  const fmtChunkSize =
    bitDepth === 'float'
      ? 4 + 4 + WAV_CONSTANTS.FLOAT_FMT_CHUNK_SIZE
      : 4 + 4 + WAV_CONSTANTS.PCM_FMT_CHUNK_SIZE;

  // data chunk 시작 위치: RIFF 헤더 (12) + fmt chunk
  const dataChunkOffset = 12 + fmtChunkSize;

  // 전체 파일 크기: RIFF 헤더 (12) + fmt chunk + data chunk 헤더 (8) + 데이터
  const totalSize = 12 + fmtChunkSize + 8 + dataSize;

  return {
    dataChunkOffset,
    totalSize,
    dataSize,
    bytesPerSample,
  };
}

/**
 * DataView에 문자열 작성
 */
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * WAV 파일 RIFF 헤더 작성
 */
function writeRiffHeader(view: DataView, totalSize: number): void {
  writeString(view, 0, 'RIFF');
  // RIFF chunk size = 전체 파일 크기 - 8 (RIFF ID 4바이트 + chunk size 4바이트)
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
}

/**
 * WAV 파일 fmt chunk 작성 (PCM 형식)
 */
function writePcmFmtChunk(
  view: DataView,
  numberOfChannels: number,
  sampleRate: number,
  bytesPerSample: number,
  bitDepth: 16 | 24 | 32
): void {
  view.setUint32(16, WAV_CONSTANTS.PCM_FMT_CHUNK_SIZE, true);
  view.setUint16(20, WAV_CONSTANTS.PCM_AUDIO_FORMAT, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * bytesPerSample, true);
  view.setUint16(32, numberOfChannels * bytesPerSample, true);
  view.setUint16(34, bitDepth, true);
}

/**
 * WAV 파일 fmt chunk 작성 (Float 형식)
 */
function writeFloatFmtChunk(
  view: DataView,
  numberOfChannels: number,
  sampleRate: number
): void {
  view.setUint32(16, WAV_CONSTANTS.FLOAT_FMT_CHUNK_SIZE, true);
  view.setUint16(20, WAV_CONSTANTS.FLOAT_AUDIO_FORMAT, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(
    28,
    sampleRate * numberOfChannels * WAV_CONSTANTS.FLOAT_BYTES_PER_SAMPLE,
    true
  );
  view.setUint16(
    32,
    numberOfChannels * WAV_CONSTANTS.FLOAT_BYTES_PER_SAMPLE,
    true
  );
  view.setUint16(34, WAV_CONSTANTS.FLOAT_BITS_PER_SAMPLE, true);
  view.setUint16(36, 0, true); // extension size
}

/**
 * WAV 파일 data chunk 헤더 작성
 *
 * @param view - DataView
 * @param dataSize - 오디오 데이터 크기
 * @param dataChunkOffset - data chunk 시작 위치 ('data' 문자열 위치)
 */
function writeDataChunkHeader(
  view: DataView,
  dataSize: number,
  dataChunkOffset: number
): void {
  // 'data' 문자열 작성 (dataChunkOffset 위치)
  writeString(view, dataChunkOffset, 'data');
  // data chunk 크기 작성 (dataChunkOffset + 4 위치)
  view.setUint32(dataChunkOffset + 4, dataSize, true);
}

/**
 * 오디오 샘플을 WAV 데이터로 작성 (Float 형식)
 */
function writeFloatSample(
  view: DataView,
  offset: number,
  sample: number
): number {
  view.setFloat32(offset, clampSample(sample), true);
  return offset + 4;
}

/**
 * 오디오 샘플을 WAV 데이터로 작성 (PCM 16-bit)
 */
function writePcm16Sample(
  view: DataView,
  offset: number,
  sample: number
): number {
  const intSample = Math.round(clampSample(sample) * PCM_MAX_VALUES[16]);
  view.setInt16(offset, intSample, true);
  return offset + 2;
}

/**
 * 오디오 샘플을 WAV 데이터로 작성 (PCM 24-bit)
 * 24-bit PCM은 signed 정수로 저장되며, 리틀 엔디안 형식으로 저장됩니다.
 */
function writePcm24Sample(
  view: DataView,
  offset: number,
  sample: number
): number {
  const clamped = clampSample(sample);
  // 24-bit signed 정수 범위: -8388608 ~ 8388607
  const intSample = Math.round(clamped * PCM_MAX_VALUES[24]);
  // signed 값을 unsigned로 변환하여 저장
  const unsignedSample = intSample < 0 ? intSample + 0x1000000 : intSample;
  // 리틀 엔디안으로 3바이트 저장
  view.setUint8(offset, unsignedSample & 0xff);
  view.setUint8(offset + 1, (unsignedSample >> 8) & 0xff);
  view.setUint8(offset + 2, (unsignedSample >> 16) & 0xff);
  return offset + 3;
}

/**
 * 오디오 샘플을 WAV 데이터로 작성 (PCM 32-bit)
 */
function writePcm32Sample(
  view: DataView,
  offset: number,
  sample: number
): number {
  const intSample = Math.round(clampSample(sample) * PCM_MAX_VALUES[32]);
  view.setInt32(offset, intSample, true);
  return offset + 4;
}

/**
 * 오디오 데이터를 WAV 파일에 작성
 */
function writeAudioData(
  view: DataView,
  audioBuffer: AudioBuffer,
  bitDepth: 16 | 24 | 32 | 'float',
  startOffset: number
): void {
  let offset = startOffset;
  const { length, numberOfChannels } = audioBuffer;

  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = audioBuffer.getChannelData(channel)[i];

      switch (bitDepth) {
        case 'float':
          offset = writeFloatSample(view, offset, sample);
          break;
        case 16:
          offset = writePcm16Sample(view, offset, sample);
          break;
        case 24:
          offset = writePcm24Sample(view, offset, sample);
          break;
        case 32:
          offset = writePcm32Sample(view, offset, sample);
          break;
      }
    }
  }
}

/**
 * AudioBuffer를 WAV 파일로 변환하는 함수
 *
 * @param audioBuffer - 변환할 오디오 버퍼
 * @param bitDepth - 비트 깊이 (16, 24, 32, 또는 'float')
 * @returns Blob - WAV 파일 Blob
 */
export function audioBufferToWav(
  audioBuffer: AudioBuffer,
  bitDepth: 16 | 24 | 32 | 'float' = DEFAULT_BIT_DEPTH
): Blob {
  const headerInfo = calculateWavHeaderInfo(audioBuffer, bitDepth);
  const buffer = new ArrayBuffer(headerInfo.totalSize);
  const view = new DataView(buffer);

  // RIFF 헤더 작성
  writeRiffHeader(view, headerInfo.totalSize);

  // fmt chunk 작성
  if (bitDepth === 'float') {
    writeFloatFmtChunk(
      view,
      audioBuffer.numberOfChannels,
      audioBuffer.sampleRate
    );
  } else {
    writePcmFmtChunk(
      view,
      audioBuffer.numberOfChannels,
      audioBuffer.sampleRate,
      headerInfo.bytesPerSample,
      bitDepth
    );
  }

  // data chunk 헤더 작성
  writeDataChunkHeader(view, headerInfo.dataSize, headerInfo.dataChunkOffset);

  // 오디오 데이터 작성 (data chunk 헤더 이후: 'data' (4) + size (4) = 8 bytes)
  writeAudioData(view, audioBuffer, bitDepth, headerInfo.dataChunkOffset + 8);

  return new Blob([buffer], { type: 'audio/wav' });
}
