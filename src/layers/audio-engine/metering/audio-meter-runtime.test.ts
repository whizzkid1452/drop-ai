import { describe, expect, it, vi } from 'vitest';
import { AudioMeterRuntime } from './audio-meter-runtime';

describe('AudioMeterRuntime', () => {
  it('Analyser의 모든 channel을 같은 시각의 MeterFrame으로 변환한다', () => {
    const analyser = {
      dispose: vi.fn(),
      getValue: vi.fn(() => [new Float32Array([0.5, -0.5]), new Float32Array([1, 0])]),
    };
    const runtime = new AudioMeterRuntime({ analyser, getCurrentTimeSeconds: () => 3.5 });

    const frame = runtime.read();

    expect(frame.capturedAtSeconds).toBe(3.5);
    expect(frame.channels[0]).toMatchObject({ peakDbfs: expect.closeTo(-6.0206, 4) });
    expect(frame.channels[1]).toMatchObject({ isClipHeld: true, peakDbfs: 0 });
  });

  it('mono Analyser 값도 하나의 channel로 반환하고 runtime을 정리한다', () => {
    const analyser = {
      dispose: vi.fn(),
      getValue: vi.fn(() => new Float32Array([0.25])),
    };
    const runtime = new AudioMeterRuntime({ analyser, getCurrentTimeSeconds: () => 1 });

    expect(runtime.read().channels).toHaveLength(1);

    runtime.dispose();
    expect(analyser.dispose).toHaveBeenCalledOnce();
  });
});
