import { describe, expect, it } from 'vitest';
import {
  analyzePcmPeak,
  detectTransientPositionsSeconds,
  pitchShiftPcmChannels,
  reversePcmChannels,
  stripSilenceFromPcmChannels,
  timeStretchPcmChannels,
} from './region-audio-processing';

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

  it('time stretch 비율만큼 frame 수를 변경하고 입력은 유지한다', () => {
    const input = [Float32Array.from({ length: 64 }, (_, index) => Math.sin((index / 64) * Math.PI * 4))];

    const stretched = timeStretchPcmChannels({ channels: input, stretchRatio: 1.5 });

    expect(stretched[0]).toHaveLength(96);
    expect(input[0]).toHaveLength(64);
  });

  it('pitch shift 뒤에도 원래 frame 수를 유지한다', () => {
    const input = [Float32Array.from({ length: 128 }, (_, index) => Math.sin((index / 16) * Math.PI))];

    const shifted = pitchShiftPcmChannels({ channels: input, semitones: 12 });

    expect(shifted[0]).toHaveLength(128);
    expect(shifted[0]).not.toEqual(input[0]);
  });

  it('에너지 상승 지점을 초 단위 transient 위치로 반환한다', () => {
    const channel = new Float32Array(100);
    channel[20] = 1;
    channel[70] = 0.8;

    const positions = detectTransientPositionsSeconds({
      channels: [channel],
      sampleRate: 100,
      sensitivity: 0.8,
    });

    expect(positions).toEqual([0.2, 0.7]);
  });
});
