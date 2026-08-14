import { describe, expect, it, vi } from 'vitest';
import {
  detectAudioCodec,
  parseBroadcastWaveMetadata,
  readBrowserAudioCodecSupport,
} from './audio-source-file-metadata';

function writeAscii(bytes: Uint8Array, offset: number, value: string): void {
  value.split('').forEach((character, index) => {
    bytes[offset + index] = character.charCodeAt(0);
  });
}

function createBroadcastWave(): ArrayBuffer {
  const codingHistory = 'A=PCM,F=48000,W=24,M=stereo';
  const bextLength = 602 + codingHistory.length;
  const bytes = new Uint8Array(12 + 8 + bextLength);
  const view = new DataView(bytes.buffer);
  writeAscii(bytes, 0, 'RIFF');
  view.setUint32(4, bytes.length - 8, true);
  writeAscii(bytes, 8, 'WAVE');
  writeAscii(bytes, 12, 'bext');
  view.setUint32(16, bextLength, true);
  writeAscii(bytes, 20, 'Field recording');
  writeAscii(bytes, 276, 'drop-ai');
  writeAscii(bytes, 308, 'DROP20260813');
  writeAscii(bytes, 340, '2026-08-13');
  writeAscii(bytes, 350, '12:34:56');
  view.setUint32(358, 48_000, true);
  view.setUint32(362, 0, true);
  writeAscii(bytes, 622, codingHistory);
  return bytes.buffer;
}

describe('audio Source file metadata', () => {
  it.each([
    ['wav', new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])],
    ['flac', new Uint8Array([0x66, 0x4c, 0x61, 0x43])],
    ['mp3', new Uint8Array([0x49, 0x44, 0x33, 0])],
    ['ogg', new Uint8Array([0x4f, 0x67, 0x67, 0x53])],
    ['webm', new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])],
  ] as const)('%s 파일 signature를 판별한다', (expectedCodec, bytes) => {
    expect(detectAudioCodec({ bytes, fileName: 'unknown.bin', mimeType: '' })).toBe(expectedCodec);
  });

  it('Broadcast Wave의 bext chunk를 읽는다', () => {
    expect(parseBroadcastWaveMetadata(createBroadcastWave())).toMatchObject({
      codingHistory: 'A=PCM,F=48000,W=24,M=stereo',
      description: 'Field recording',
      originationDate: '2026-08-13',
      originationTime: '12:34:56',
      originator: 'drop-ai',
      originatorReference: 'DROP20260813',
      timeReferenceSamples: 48_000,
    });
  });

  it('브라우저 canPlayType 결과를 codec별 runtime 지원 상태로 반환한다', () => {
    const canPlayType = vi.fn((mimeType: string) => (mimeType === 'audio/wav' ? 'probably' : ''));
    const support = readBrowserAudioCodecSupport({ canPlayType });

    expect(support.find(entry => entry.codec === 'wav')).toMatchObject({ isSupported: true });
    expect(support.find(entry => entry.codec === 'flac')).toMatchObject({ isSupported: false });
  });
});
