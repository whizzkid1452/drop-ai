import { describe, expect, it, vi } from 'vitest';
import { encodeAudioBufferToWav } from './wav-encoder';

describe('encodeAudioBufferToWav', () => {
  it('AudioBuffer 샘플을 16-bit PCM WAV로 기록한다', async () => {
    const audioBuffer = {
      length: 2,
      numberOfChannels: 1,
      sampleRate: 8000,
      getChannelData: () => new Float32Array([0.5, -0.5]),
    } as unknown as AudioBuffer;

    const wav = await encodeAudioBufferToWav(audioBuffer).arrayBuffer();
    const view = new DataView(wav);
    const readText = (offset: number, length: number) => String.fromCharCode(...new Uint8Array(wav, offset, length));

    expect(readText(0, 4)).toBe('RIFF');
    expect(readText(8, 4)).toBe('WAVE');
    expect(readText(36, 4)).toBe('data');
    expect(view.getUint32(40, true)).toBe(4);
    expect(view.getInt16(44, true)).not.toBe(0);
    expect(view.getInt16(46, true)).not.toBe(0);
  });

  it('채널 데이터를 채널별로 한 번만 조회한다', () => {
    const channels = [new Float32Array([0, 0, 0]), new Float32Array([0, 0, 0])];
    const getChannelData = vi.fn((channelIndex: number) => channels[channelIndex]);
    const audioBuffer = {
      length: 3,
      numberOfChannels: channels.length,
      sampleRate: 8000,
      getChannelData,
    } as unknown as AudioBuffer;

    encodeAudioBufferToWav(audioBuffer);

    expect(getChannelData).toHaveBeenCalledTimes(channels.length);
  });

  it('스테레오 샘플을 채널 순서대로 교차 배치하고 범위를 제한한다', async () => {
    const channels = [new Float32Array([1, -1, 1.5]), new Float32Array([0.5, -0.5, -1.5])];
    const audioBuffer = {
      length: 3,
      numberOfChannels: channels.length,
      sampleRate: 8000,
      getChannelData: (channelIndex: number) => channels[channelIndex],
    } as unknown as AudioBuffer;

    const wav = await encodeAudioBufferToWav(audioBuffer).arrayBuffer();
    const view = new DataView(wav);

    expect(Array.from({ length: 6 }, (_, index) => view.getInt16(44 + index * 2, true))).toEqual([
      32767, 16384, -32768, -16384, 32767, -32768,
    ]);
  });

  it.each([
    { audioFormat: 1, bitsPerSample: 16, bytesPerSample: 2, sampleFormat: 'pcm16' as const },
    { audioFormat: 1, bitsPerSample: 24, bytesPerSample: 3, sampleFormat: 'pcm24' as const },
    { audioFormat: 3, bitsPerSample: 32, bytesPerSample: 4, sampleFormat: 'float32' as const },
  ])('$sampleFormat WAV header와 sample 크기를 기록한다', async options => {
    const audioBuffer = {
      length: 2,
      numberOfChannels: 1,
      sampleRate: 48_000,
      getChannelData: () => new Float32Array([1, -1]),
    } as unknown as AudioBuffer;

    const wav = await encodeAudioBufferToWav(audioBuffer, { sampleFormat: options.sampleFormat }).arrayBuffer();
    const view = new DataView(wav);

    expect(view.getUint16(20, true)).toBe(options.audioFormat);
    expect(view.getUint16(34, true)).toBe(options.bitsPerSample);
    expect(view.getUint32(40, true)).toBe(2 * options.bytesPerSample);
  });

  it('stereo 입력을 mono 평균으로 downmix한다', async () => {
    const channels = [new Float32Array([1]), new Float32Array([-0.5])];
    const audioBuffer = {
      length: 1,
      numberOfChannels: 2,
      sampleRate: 8_000,
      getChannelData: (channelIndex: number) => channels[channelIndex],
    } as unknown as AudioBuffer;

    const wav = await encodeAudioBufferToWav(audioBuffer, { channelMode: 'mono', dither: 'none' }).arrayBuffer();
    const view = new DataView(wav);

    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getInt16(44, true)).toBeCloseTo(0.25 * 0x7fff, -1);
  });

  it('고정 난수 TPDF dither를 PCM 양자화 전에 적용한다', async () => {
    const audioBuffer = {
      length: 1,
      numberOfChannels: 1,
      sampleRate: 8_000,
      getChannelData: () => new Float32Array([0]),
    } as unknown as AudioBuffer;

    const wav = await encodeAudioBufferToWav(audioBuffer, {
      dither: 'tpdf',
      random: () => 1,
      sampleFormat: 'pcm16',
    }).arrayBuffer();

    expect(new DataView(wav).getInt16(44, true)).toBe(1);
  });
});
