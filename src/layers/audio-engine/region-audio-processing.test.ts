import { describe, expect, it } from 'vitest';
import { analyzePcmPeak, reversePcmChannels, stripSilenceFromPcmChannels } from './region-audio-processing';

describe('Region PCM 처리', () => {
  it('모든 Channel의 절댓값 중 가장 큰 값을 peak로 반환한다', () => {
    const peak = analyzePcmPeak([new Float32Array([0.1, -0.8]), new Float32Array([0.5, -0.2])]);

    expect(peak).toBeCloseTo(0.8);
  });

  it('각 Channel의 sample 순서를 뒤집고 입력 배열은 변경하지 않는다', () => {
    const input = [new Float32Array([1, 2, 3]), new Float32Array([4, 5, 6])];

    const reversed = reversePcmChannels(input);

    expect([...reversed[0]!]).toEqual([3, 2, 1]);
    expect([...reversed[1]!]).toEqual([6, 5, 4]);
    expect([...input[0]!]).toEqual([1, 2, 3]);
  });

  it('최소 길이 이상 이어진 무음 frame만 모든 Channel에서 제거한다', () => {
    const channels = [new Float32Array([0.5, 0, 0, 0, 0.25, 0, 0.5]), new Float32Array([0.25, 0, 0, 0, 0.1, 0, 0.25])];

    const stripped = stripSilenceFromPcmChannels({
      channels,
      minimumSilenceFrames: 2,
      thresholdLinear: 0.01,
    });

    expect([...stripped[0]!]).toEqual([0.5, 0.25, 0, 0.5]);
    expect(stripped[1]).toEqual(new Float32Array([0.25, 0.1, 0, 0.25]));
  });
});
