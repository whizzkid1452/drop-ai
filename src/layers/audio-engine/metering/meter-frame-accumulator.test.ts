import { describe, expect, it } from 'vitest';
import { MeterFrameAccumulator } from './meter-frame-accumulator';

describe('MeterFrameAccumulator', () => {
  it('무음 channel을 -Infinity dBFS로 반환한다', () => {
    const accumulator = new MeterFrameAccumulator();

    const frame = accumulator.read({ capturedAtSeconds: 1, channelSamples: [new Float32Array(4)] });

    expect(frame.channels).toEqual([{ isClipHeld: false, peakDbfs: -Infinity, rmsDbfs: -Infinity }]);
  });

  it('channel별 peak와 RMS를 dBFS로 계산한다', () => {
    const accumulator = new MeterFrameAccumulator();

    const frame = accumulator.read({
      capturedAtSeconds: 1,
      channelSamples: [new Float32Array([0.5, -0.5, 0.5, -0.5]), new Float32Array([1, 0, 0, 0])],
    });

    expect(frame.channels[0]).toMatchObject({
      peakDbfs: expect.closeTo(-6.0206, 4),
      rmsDbfs: expect.closeTo(-6.0206, 4),
    });
    expect(frame.channels[1]).toMatchObject({ peakDbfs: 0, rmsDbfs: expect.closeTo(-6.0206, 4) });
  });

  it('0 dBFS 이상 신호를 지정 시간 동안 clip hold한다', () => {
    const accumulator = new MeterFrameAccumulator({ clipHoldSeconds: 2 });

    const clipping = accumulator.read({
      capturedAtSeconds: 1,
      channelSamples: [new Float32Array([1])],
    });
    const held = accumulator.read({
      capturedAtSeconds: 2.9,
      channelSamples: [new Float32Array([0.1])],
    });
    const released = accumulator.read({
      capturedAtSeconds: 3,
      channelSamples: [new Float32Array([0.1])],
    });

    expect(clipping.channels[0]?.isClipHeld).toBe(true);
    expect(held.channels[0]?.isClipHeld).toBe(true);
    expect(released.channels[0]?.isClipHeld).toBe(false);
  });

  it('비유한 sample은 무음으로 처리한다', () => {
    const accumulator = new MeterFrameAccumulator();

    const frame = accumulator.read({
      capturedAtSeconds: 1,
      channelSamples: [new Float32Array([Number.NaN, Number.POSITIVE_INFINITY])],
    });

    expect(frame.channels[0]).toEqual({ isClipHeld: false, peakDbfs: -Infinity, rmsDbfs: -Infinity });
  });
});
