import {
  WAV_CONSTANTS,
  BYTES_PER_SAMPLE,
  PCM_MAX_VALUES,
  DEFAULT_BIT_DEPTH,
  AUDIO_SAMPLE_MIN,
  AUDIO_SAMPLE_MAX,
} from '../constants';
import type { WavHeaderInfo } from '../types';

/**
 * WAV ?�더 ?�보 계산
 *
 * WAV ?�일 구조:
 * - RIFF ?�더: 12 bytes ('RIFF' + size + 'WAVE')
 * - fmt chunk: 24 bytes (PCM) or 26 bytes (Float) ('fmt ' + size + data)
 * - data chunk: 8 bytes + dataSize ('data' + size + audio data)
 */
export function calculateWavHeaderInfo(audioBuffer: AudioBuffer, bitDepth: 16 | 24 | 32 | 'float'): WavHeaderInfo {
  const bytesPerSample = BYTES_PER_SAMPLE[bitDepth];
  const dataSize = audioBuffer.length * audioBuffer.numberOfChannels * bytesPerSample;

  // fmt chunk ?�기: 'fmt ' (4) + size (4) + data (16 or 18)
  const fmtChunkSize =
    bitDepth === 'float' ? 4 + 4 + WAV_CONSTANTS.FLOAT_FMT_CHUNK_SIZE : 4 + 4 + WAV_CONSTANTS.PCM_FMT_CHUNK_SIZE;

  // data chunk ?�작 ?�치: RIFF ?�더 (12) + fmt chunk
  const dataChunkOffset = 12 + fmtChunkSize;

  // ?�체 ?�일 ?�기: RIFF ?�더 (12) + fmt chunk + data chunk ?�더 (8) + ?�이??
  const totalSize = 12 + fmtChunkSize + 8 + dataSize;

  return {
    dataChunkOffset,
    totalSize,
    dataSize,
    bytesPerSample,
  };
}

/**
 * DataView??문자???�성
 */
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * WAV ?�일 RIFF ?�더 ?�성
 */
function writeRiffHeader(view: DataView, totalSize: number): void {
  writeString(view, 0, 'RIFF');
  // RIFF chunk size = ?�체 ?�일 ?�기 - 8 (RIFF ID 4바이??+ chunk size 4바이??
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
}

/**
 * WAV ?�일 fmt chunk ?�성 (PCM ?�식)
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
 * WAV ?�일 fmt chunk ?�성 (Float ?�식)
 */
function writeFloatFmtChunk(view: DataView, numberOfChannels: number, sampleRate: number): void {
  view.setUint32(16, WAV_CONSTANTS.FLOAT_FMT_CHUNK_SIZE, true);
  view.setUint16(20, WAV_CONSTANTS.FLOAT_AUDIO_FORMAT, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * WAV_CONSTANTS.FLOAT_BYTES_PER_SAMPLE, true);
  view.setUint16(32, numberOfChannels * WAV_CONSTANTS.FLOAT_BYTES_PER_SAMPLE, true);
  view.setUint16(34, WAV_CONSTANTS.FLOAT_BITS_PER_SAMPLE, true);
  view.setUint16(36, 0, true); // extension size
}

/**
 * WAV ?�일 data chunk ?�더 ?�성
 *
 * @param view - DataView
 * @param dataSize - ?�디???�이???�기
 * @param dataChunkOffset - data chunk ?�작 ?�치 ('data' 문자???�치)
 */
function writeDataChunkHeader(view: DataView, dataSize: number, dataChunkOffset: number): void {
  // 'data' 문자???�성 (dataChunkOffset ?�치)
  writeString(view, dataChunkOffset, 'data');
  // data chunk ?�기 ?�성 (dataChunkOffset + 4 ?�치)
  view.setUint32(dataChunkOffset + 4, dataSize, true);
}

/**
 * ?�디???�플??WAV ?�이?�로 ?�성 (Float ?�식)
 */
function writeFloatSample(view: DataView, offset: number, sample: number): number {
  view.setFloat32(offset, clampSample(sample), true);
  return offset + 4;
}

/**
 * ?�디???�플??WAV ?�이?�로 ?�성 (PCM 16-bit)
 */
function writePcm16Sample(view: DataView, offset: number, sample: number): number {
  const intSample = Math.round(clampSample(sample) * PCM_MAX_VALUES[16]);
  view.setInt16(offset, intSample, true);
  return offset + 2;
}

/**
 * ?�디???�플??WAV ?�이?�로 ?�성 (PCM 24-bit)
 * 24-bit PCM?� signed ?�수�??�?�되�? 리�? ?�디???�식?�로 ?�?�됩?�다.
 */
function writePcm24Sample(view: DataView, offset: number, sample: number): number {
  const clamped = clampSample(sample);
  // 24-bit signed ?�수 범위: -8388608 ~ 8388607
  const intSample = Math.round(clamped * PCM_MAX_VALUES[24]);
  // signed 값을 unsigned�?변?�하???�??
  const unsignedSample = intSample < 0 ? intSample + 0x1000000 : intSample;
  // 리�? ?�디?�으�?3바이???�??
  view.setUint8(offset, unsignedSample & 0xff);
  view.setUint8(offset + 1, (unsignedSample >> 8) & 0xff);
  view.setUint8(offset + 2, (unsignedSample >> 16) & 0xff);
  return offset + 3;
}

/**
 * ?�디???�플??WAV ?�이?�로 ?�성 (PCM 32-bit)
 */
function writePcm32Sample(view: DataView, offset: number, sample: number): number {
  const intSample = Math.round(clampSample(sample) * PCM_MAX_VALUES[32]);
  view.setInt32(offset, intSample, true);
  return offset + 4;
}

/**
 * ?�디???�이?��? WAV ?�일???�성
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
 * AudioBuffer�?WAV ?�일�?변?�하???�수
 *
 * @param audioBuffer - 변?�할 ?�디??버퍼
 * @param bitDepth - 비트 깊이 (16, 24, 32, ?�는 'float')
 * @returns Blob - WAV ?�일 Blob
 */
export function audioBufferToWav(audioBuffer: AudioBuffer, bitDepth: 16 | 24 | 32 | 'float' = DEFAULT_BIT_DEPTH): Blob {
  const headerInfo = calculateWavHeaderInfo(audioBuffer, bitDepth);
  const buffer = new ArrayBuffer(headerInfo.totalSize);
  const view = new DataView(buffer);

  // RIFF ?�더 ?�성
  writeRiffHeader(view, headerInfo.totalSize);

  // fmt chunk ?�성
  if (bitDepth === 'float') {
    writeFloatFmtChunk(view, audioBuffer.numberOfChannels, audioBuffer.sampleRate);
  } else {
    writePcmFmtChunk(view, audioBuffer.numberOfChannels, audioBuffer.sampleRate, headerInfo.bytesPerSample, bitDepth);
  }

  // data chunk ?�더 ?�성
  writeDataChunkHeader(view, headerInfo.dataSize, headerInfo.dataChunkOffset);

  // ?�디???�이???�성 (data chunk ?�더 ?�후: 'data' (4) + size (4) = 8 bytes)
  writeAudioData(view, audioBuffer, bitDepth, headerInfo.dataChunkOffset + 8);

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * ?�디???�플 값을 [-1, 1] 범위�??�한
 */
export function clampSample(value: number): number {
  return Math.max(AUDIO_SAMPLE_MIN, Math.min(AUDIO_SAMPLE_MAX, value));
}
