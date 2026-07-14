import { describe, expect, it } from 'vitest';
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
});
