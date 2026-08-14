import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CHANNEL_COUNT = 1;
const SAMPLE_RATE = 48_000;
const BITS_PER_SAMPLE = 16;
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;
const DURATION_SECONDS = 2;
const FREQUENCY_HZ = 440;
const PEAK_AMPLITUDE = 8_192;
const WAV_HEADER_SIZE = 44;

export function ensureFakeAudioInputFixture(): string {
  const fixtureDirectory = resolve('.playwright');
  const fixturePath = resolve(fixtureDirectory, 'fake-audio-input.wav');
  if (existsSync(fixturePath)) {
    return fixturePath.replaceAll('\\', '/');
  }

  mkdirSync(fixtureDirectory, { recursive: true });
  writeFileSync(fixturePath, createSineWaveWav());
  return fixturePath.replaceAll('\\', '/');
}

function createSineWaveWav(): Buffer {
  const sampleCount = SAMPLE_RATE * DURATION_SECONDS;
  const dataSize = sampleCount * CHANNEL_COUNT * BYTES_PER_SAMPLE;
  const wav = Buffer.alloc(WAV_HEADER_SIZE + dataSize);
  const byteRate = SAMPLE_RATE * CHANNEL_COUNT * BYTES_PER_SAMPLE;
  const blockAlign = CHANNEL_COUNT * BYTES_PER_SAMPLE;

  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(CHANNEL_COUNT, 22);
  wav.writeUInt32LE(SAMPLE_RATE, 24);
  wav.writeUInt32LE(byteRate, 28);
  wav.writeUInt16LE(blockAlign, 32);
  wav.writeUInt16LE(BITS_PER_SAMPLE, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const phase = (2 * Math.PI * FREQUENCY_HZ * sampleIndex) / SAMPLE_RATE;
    wav.writeInt16LE(Math.round(Math.sin(phase) * PEAK_AMPLITUDE), WAV_HEADER_SIZE + sampleIndex * BYTES_PER_SAMPLE);
  }

  return wav;
}
