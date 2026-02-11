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
 * WAV ?§Îçî ?ïÎ≥¥ Í≥ÑÏÇ∞
 *
 * WAV ?åÏùº Íµ¨Ï°∞:
 * - RIFF ?§Îçî: 12 bytes ('RIFF' + size + 'WAVE')
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

  // fmt chunk ?¨Í∏∞: 'fmt ' (4) + size (4) + data (16 or 18)
  const fmtChunkSize =
    bitDepth === 'float'
      ? 4 + 4 + WAV_CONSTANTS.FLOAT_FMT_CHUNK_SIZE
      : 4 + 4 + WAV_CONSTANTS.PCM_FMT_CHUNK_SIZE;

  // data chunk ?úÏûë ?ÑÏπò: RIFF ?§Îçî (12) + fmt chunk
  const dataChunkOffset = 12 + fmtChunkSize;

  // ?ÑÏ≤¥ ?åÏùº ?¨Í∏∞: RIFF ?§Îçî (12) + fmt chunk + data chunk ?§Îçî (8) + ?∞Ïù¥??
  const totalSize = 12 + fmtChunkSize + 8 + dataSize;

  return {
    dataChunkOffset,
    totalSize,
    dataSize,
    bytesPerSample,
  };
}

/**
 * DataView??Î¨∏Ïûê???ëÏÑ±
 */
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * WAV ?åÏùº RIFF ?§Îçî ?ëÏÑ±
 */
function writeRiffHeader(view: DataView, totalSize: number): void {
  writeString(view, 0, 'RIFF');
  // RIFF chunk size = ?ÑÏ≤¥ ?åÏùº ?¨Í∏∞ - 8 (RIFF ID 4Î∞îÏù¥??+ chunk size 4Î∞îÏù¥??
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
}

/**
 * WAV ?åÏùº fmt chunk ?ëÏÑ± (PCM ?ïÏãù)
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
 * WAV ?åÏùº fmt chunk ?ëÏÑ± (Float ?ïÏãù)
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
 * WAV ?åÏùº data chunk ?§Îçî ?ëÏÑ±
 *
 * @param view - DataView
 * @param dataSize - ?§Îîî???∞Ïù¥???¨Í∏∞
 * @param dataChunkOffset - data chunk ?úÏûë ?ÑÏπò ('data' Î¨∏Ïûê???ÑÏπò)
 */
function writeDataChunkHeader(
  view: DataView,
  dataSize: number,
  dataChunkOffset: number
): void {
  // 'data' Î¨∏Ïûê???ëÏÑ± (dataChunkOffset ?ÑÏπò)
  writeString(view, dataChunkOffset, 'data');
  // data chunk ?¨Í∏∞ ?ëÏÑ± (dataChunkOffset + 4 ?ÑÏπò)
  view.setUint32(dataChunkOffset + 4, dataSize, true);
}

/**
 * ?§Îîî???òÌîå??WAV ?∞Ïù¥?∞Î°ú ?ëÏÑ± (Float ?ïÏãù)
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
 * ?§Îîî???òÌîå??WAV ?∞Ïù¥?∞Î°ú ?ëÏÑ± (PCM 16-bit)
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
 * ?§Îîî???òÌîå??WAV ?∞Ïù¥?∞Î°ú ?ëÏÑ± (PCM 24-bit)
 * 24-bit PCM?Ä signed ?ïÏàòÎ°??Ä?•ÎêòÎ©? Î¶¨Ì? ?îÎîî???ïÏãù?ºÎ°ú ?Ä?•Îê©?àÎã§.
 */
function writePcm24Sample(
  view: DataView,
  offset: number,
  sample: number
): number {
  const clamped = clampSample(sample);
  // 24-bit signed ?ïÏàò Î≤îÏúÑ: -8388608 ~ 8388607
  const intSample = Math.round(clamped * PCM_MAX_VALUES[24]);
  // signed Í∞íÏùÑ unsignedÎ°?Î≥Ä?òÌïò???Ä??
  const unsignedSample = intSample < 0 ? intSample + 0x1000000 : intSample;
  // Î¶¨Ì? ?îÎîî?àÏúºÎ°?3Î∞îÏù¥???Ä??
  view.setUint8(offset, unsignedSample & 0xff);
  view.setUint8(offset + 1, (unsignedSample >> 8) & 0xff);
  view.setUint8(offset + 2, (unsignedSample >> 16) & 0xff);
  return offset + 3;
}

/**
 * ?§Îîî???òÌîå??WAV ?∞Ïù¥?∞Î°ú ?ëÏÑ± (PCM 32-bit)
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
 * ?§Îîî???∞Ïù¥?∞Î? WAV ?åÏùº???ëÏÑ±
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
 * AudioBufferÎ•?WAV ?åÏùºÎ°?Î≥Ä?òÌïò???®Ïàò
 *
 * @param audioBuffer - Î≥Ä?òÌï† ?§Îîî??Î≤ÑÌçº
 * @param bitDepth - ÎπÑÌä∏ ÍπäÏù¥ (16, 24, 32, ?êÎäî 'float')
 * @returns Blob - WAV ?åÏùº Blob
 */
export function audioBufferToWav(
  audioBuffer: AudioBuffer,
  bitDepth: 16 | 24 | 32 | 'float' = DEFAULT_BIT_DEPTH
): Blob {
  const headerInfo = calculateWavHeaderInfo(audioBuffer, bitDepth);
  const buffer = new ArrayBuffer(headerInfo.totalSize);
  const view = new DataView(buffer);

  // RIFF ?§Îçî ?ëÏÑ±
  writeRiffHeader(view, headerInfo.totalSize);

  // fmt chunk ?ëÏÑ±
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

  // data chunk ?§Îçî ?ëÏÑ±
  writeDataChunkHeader(view, headerInfo.dataSize, headerInfo.dataChunkOffset);

  // ?§Îîî???∞Ïù¥???ëÏÑ± (data chunk ?§Îçî ?¥ÌõÑ: 'data' (4) + size (4) = 8 bytes)
  writeAudioData(view, audioBuffer, bitDepth, headerInfo.dataChunkOffset + 8);

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * ?§Îîî???òÌîå Í∞íÏùÑ [-1, 1] Î≤îÏúÑÎ°??úÌïú
 */
export function clampSample(value: number): number {
  return Math.max(AUDIO_SAMPLE_MIN, Math.min(AUDIO_SAMPLE_MAX, value));
}
