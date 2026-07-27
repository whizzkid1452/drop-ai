import { describe, expect, it } from 'vitest';
import { PcmRingBuffer } from './pcm-ring-buffer';

describe('PcmRingBuffer', () => {
  it('채널별 PCM 프레임을 입력 순서대로 읽는다', () => {
    const buffer = new PcmRingBuffer({ capacityFrames: 4, channelCount: 2 });

    buffer.write([new Float32Array([0.1, 0.2]), new Float32Array([0.3, 0.4])]);

    const [leftChannel, rightChannel] = buffer.readChannels();
    expect(Array.from(leftChannel)).toEqual([expect.closeTo(0.1), expect.closeTo(0.2)]);
    expect(Array.from(rightChannel)).toEqual([expect.closeTo(0.3), expect.closeTo(0.4)]);
    expect(buffer.frameCount).toBe(2);
    expect(buffer.isFull).toBe(false);
  });

  it('용량을 넘으면 가장 오래된 프레임부터 덮어쓴다', () => {
    const buffer = new PcmRingBuffer({ capacityFrames: 3, channelCount: 1 });

    buffer.write([new Float32Array([1, 2])]);
    buffer.write([new Float32Array([3, 4])]);

    expect(Array.from(buffer.readChannels()[0])).toEqual([2, 3, 4]);
    expect(buffer.frameCount).toBe(3);
    expect(buffer.isFull).toBe(true);
  });

  it('채널 길이가 다르면 기존 프레임을 변경하지 않는다', () => {
    const buffer = new PcmRingBuffer({ capacityFrames: 4, channelCount: 2 });
    buffer.write([new Float32Array([1]), new Float32Array([2])]);

    expect(() => buffer.write([new Float32Array([3, 4]), new Float32Array([5])])).toThrow(
      '모든 입력 채널의 프레임 수가 같아야 합니다.'
    );
    expect(buffer.readChannels().map(channel => Array.from(channel))).toEqual([[1], [2]]);
  });

  it('초기화하면 저장된 프레임을 제거한다', () => {
    const buffer = new PcmRingBuffer({ capacityFrames: 2, channelCount: 1 });
    buffer.write([new Float32Array([1, 2])]);

    buffer.clear();

    expect(buffer.frameCount).toBe(0);
    expect(Array.from(buffer.readChannels()[0])).toEqual([]);
  });
});
