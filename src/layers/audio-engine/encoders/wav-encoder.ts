const WAV_HEADER_SIZE = 44;
const PCM_BITS_PER_SAMPLE = 16;
const PCM_BYTES_PER_SAMPLE = PCM_BITS_PER_SAMPLE / 8;
const PCM_FORMAT = 1;
const PCM_POSITIVE_MAX = 0x7fff;
const PCM_NEGATIVE_MAX = 0x8000;

function writeText(view: DataView, options: { offset: number; value: string }): void {
  const { offset, value } = options;
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function clampSample(sample: number): number {
  return Math.max(-1, Math.min(1, sample));
}

export function encodeAudioBufferToWav(audioBuffer: AudioBuffer): Blob {
  const dataSize = audioBuffer.length * audioBuffer.numberOfChannels * PCM_BYTES_PER_SAMPLE;
  const wavBuffer = new ArrayBuffer(WAV_HEADER_SIZE + dataSize);
  const view = new DataView(wavBuffer);

  writeText(view, { offset: 0, value: 'RIFF' });
  view.setUint32(4, wavBuffer.byteLength - 8, true);
  writeText(view, { offset: 8, value: 'WAVE' });
  writeText(view, { offset: 12, value: 'fmt ' });
  view.setUint32(16, 16, true);
  view.setUint16(20, PCM_FORMAT, true);
  view.setUint16(22, audioBuffer.numberOfChannels, true);
  view.setUint32(24, audioBuffer.sampleRate, true);
  view.setUint32(28, audioBuffer.sampleRate * audioBuffer.numberOfChannels * PCM_BYTES_PER_SAMPLE, true);
  view.setUint16(32, audioBuffer.numberOfChannels * PCM_BYTES_PER_SAMPLE, true);
  view.setUint16(34, PCM_BITS_PER_SAMPLE, true);
  writeText(view, { offset: 36, value: 'data' });
  view.setUint32(40, dataSize, true);

  let writeOffset = WAV_HEADER_SIZE;
  for (let sampleIndex = 0; sampleIndex < audioBuffer.length; sampleIndex += 1) {
    for (let channelIndex = 0; channelIndex < audioBuffer.numberOfChannels; channelIndex += 1) {
      const sample = clampSample(audioBuffer.getChannelData(channelIndex)[sampleIndex]);
      const pcmSample = Math.round(sample * (sample < 0 ? PCM_NEGATIVE_MAX : PCM_POSITIVE_MAX));
      view.setInt16(writeOffset, pcmSample, true);
      writeOffset += PCM_BYTES_PER_SAMPLE;
    }
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}
