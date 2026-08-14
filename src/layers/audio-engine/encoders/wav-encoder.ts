import type { ExportChannelMode, ExportDitherMode, ExportSampleFormat } from '../../shared/types/export-state';

const WAV_HEADER_SIZE = 44;
const PCM_FORMAT = 1;
const IEEE_FLOAT_FORMAT = 3;
const PCM_16_POSITIVE_MAX = 0x7fff;
const PCM_16_NEGATIVE_MAX = 0x8000;
const PCM_24_POSITIVE_MAX = 0x7fffff;
const PCM_24_NEGATIVE_MAX = 0x800000;

export interface WavEncoderOptions {
  readonly channelMode?: ExportChannelMode;
  readonly dither?: ExportDitherMode;
  readonly random?: () => number;
  readonly sampleFormat?: ExportSampleFormat;
}

interface WavFormatDescription {
  readonly audioFormat: number;
  readonly bitsPerSample: number;
  readonly bytesPerSample: number;
}

function writeText(view: DataView, options: { offset: number; value: string }): void {
  const { offset, value } = options;
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function clampSample(sample: number): number {
  return Math.max(-1, Math.min(1, sample));
}

function describeWavFormat(sampleFormat: ExportSampleFormat): WavFormatDescription {
  if (sampleFormat === 'pcm24') {
    return { audioFormat: PCM_FORMAT, bitsPerSample: 24, bytesPerSample: 3 };
  }
  if (sampleFormat === 'float32') {
    return { audioFormat: IEEE_FLOAT_FORMAT, bitsPerSample: 32, bytesPerSample: 4 };
  }
  return { audioFormat: PCM_FORMAT, bitsPerSample: 16, bytesPerSample: 2 };
}

function readOutputSample(
  channelSamples: readonly Float32Array[],
  channelMode: ExportChannelMode,
  channelIndex: number,
  sampleIndex: number
): number {
  if (channelMode === 'mono') {
    let sum = 0;
    for (let sourceChannelIndex = 0; sourceChannelIndex < channelSamples.length; sourceChannelIndex += 1) {
      sum += channelSamples[sourceChannelIndex][sampleIndex] ?? 0;
    }
    return sum / channelSamples.length;
  }
  const sourceChannelIndex = Math.min(channelIndex, channelSamples.length - 1);
  return channelSamples[sourceChannelIndex][sampleIndex] ?? 0;
}

function createTpdfNoise(random: () => number, maximumInteger: number): number {
  return (random() + random() - 1) / maximumInteger;
}

function writePcm24(view: DataView, offset: number, value: number): void {
  const unsignedValue = value < 0 ? value + 0x1000000 : value;
  view.setUint8(offset, unsignedValue & 0xff);
  view.setUint8(offset + 1, (unsignedValue >>> 8) & 0xff);
  view.setUint8(offset + 2, (unsignedValue >>> 16) & 0xff);
}

function writeSample(
  view: DataView,
  options: {
    readonly dither: ExportDitherMode;
    readonly offset: number;
    readonly random: () => number;
    readonly sample: number;
    readonly sampleFormat: ExportSampleFormat;
  }
): void {
  const { dither, offset, random, sample, sampleFormat } = options;
  if (sampleFormat === 'float32') {
    view.setFloat32(offset, clampSample(sample), true);
    return;
  }

  const positiveMaximum = sampleFormat === 'pcm24' ? PCM_24_POSITIVE_MAX : PCM_16_POSITIVE_MAX;
  const negativeMaximum = sampleFormat === 'pcm24' ? PCM_24_NEGATIVE_MAX : PCM_16_NEGATIVE_MAX;
  const ditheredSample = sample + (dither === 'tpdf' ? createTpdfNoise(random, positiveMaximum) : 0);
  const clampedSample = clampSample(ditheredSample);
  const integerSample = Math.round(clampedSample * (clampedSample < 0 ? negativeMaximum : positiveMaximum));
  if (sampleFormat === 'pcm24') {
    writePcm24(view, offset, integerSample);
    return;
  }
  view.setInt16(offset, integerSample, true);
}

export function encodeAudioBufferToWav(audioBuffer: AudioBuffer, options: WavEncoderOptions = {}): Blob {
  const channelMode = options.channelMode ?? (audioBuffer.numberOfChannels === 1 ? 'mono' : 'stereo');
  const dither = options.dither ?? 'none';
  const random = options.random ?? Math.random;
  const sampleFormat = options.sampleFormat ?? 'pcm16';
  const format = describeWavFormat(sampleFormat);
  const channelCount = channelMode === 'mono' ? 1 : 2;
  const dataSize = audioBuffer.length * channelCount * format.bytesPerSample;
  const wavBuffer = new ArrayBuffer(WAV_HEADER_SIZE + dataSize);
  const view = new DataView(wavBuffer);
  // 채널 참조를 루프 밖에서 고정해 조회 횟수가 샘플 수에 비례해 늘어나지 않게 한다.
  const channelSamples = Array.from({ length: audioBuffer.numberOfChannels }, (_, channelIndex) =>
    audioBuffer.getChannelData(channelIndex)
  );

  writeText(view, { offset: 0, value: 'RIFF' });
  view.setUint32(4, wavBuffer.byteLength - 8, true);
  writeText(view, { offset: 8, value: 'WAVE' });
  writeText(view, { offset: 12, value: 'fmt ' });
  view.setUint32(16, 16, true);
  view.setUint16(20, format.audioFormat, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, audioBuffer.sampleRate, true);
  view.setUint32(28, audioBuffer.sampleRate * channelCount * format.bytesPerSample, true);
  view.setUint16(32, channelCount * format.bytesPerSample, true);
  view.setUint16(34, format.bitsPerSample, true);
  writeText(view, { offset: 36, value: 'data' });
  view.setUint32(40, dataSize, true);

  let writeOffset = WAV_HEADER_SIZE;
  for (let sampleIndex = 0; sampleIndex < audioBuffer.length; sampleIndex += 1) {
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      writeSample(view, {
        dither,
        offset: writeOffset,
        random,
        sample: readOutputSample(channelSamples, channelMode, channelIndex, sampleIndex),
        sampleFormat,
      });
      writeOffset += format.bytesPerSample;
    }
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}
