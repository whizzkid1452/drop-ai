import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const analyser = {
    disconnect: vi.fn(),
    fftSize: 32,
    getFloatTimeDomainData: vi.fn((samples: Float32Array) => {
      samples.fill(0.5);
    }),
    smoothingTimeConstant: 1,
  };
  const source = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  const context = {
    createAnalyser: vi.fn(() => analyser),
    createBuffer: vi.fn(),
    createMediaStreamSource: vi.fn(() => source),
    currentTime: 7,
  };
  return { analyser, context, source };
});

vi.mock('tone', () => ({
  Player: class {},
  getContext: () => ({ rawContext: mocks.context, state: 'running' }),
  getTransport: () => ({ seconds: 0 }),
  now: () => mocks.context.currentTime,
  start: vi.fn(),
}));

import { ToneLoopPlaybackAdapter } from './tone-loop-playback-adapter';

describe('ToneLoopPlaybackAdapter input meter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.context.currentTime = 7;
  });

  it('monitoring이 꺼져 있어도 입력 source를 Analyser에 연결한다', () => {
    const adapter = new ToneLoopPlaybackAdapter();

    adapter.setMonitoring({ destination: null, stream: {} as MediaStream });

    expect(mocks.source.connect).toHaveBeenCalledOnce();
    expect(mocks.source.connect).toHaveBeenCalledWith(mocks.analyser);
    expect(adapter.readInputMeterFrame()).toMatchObject({
      capturedAtSeconds: 7,
      channels: [{ peakDbfs: expect.closeTo(-6.0206, 4), rmsDbfs: expect.closeTo(-6.0206, 4) }],
    });
  });

  it('monitoring destination을 추가하고 입력 교체 뒤 이전 meter 연결을 정리한다', () => {
    const adapter = new ToneLoopPlaybackAdapter();
    const destination = {} as AudioNode;
    adapter.setMonitoring({ destination, stream: {} as MediaStream });

    adapter.setMonitoring({ destination: null, stream: {} as MediaStream });

    expect(mocks.source.connect).toHaveBeenCalledWith(destination);
    expect(mocks.source.disconnect).toHaveBeenCalledOnce();
    expect(mocks.analyser.disconnect).toHaveBeenCalledOnce();
  });
});
