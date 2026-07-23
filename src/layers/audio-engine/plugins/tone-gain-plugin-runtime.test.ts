import { beforeEach, describe, expect, it, vi } from 'vitest';

interface GainMockState {
  readonly gain: {
    value: number;
    rampTo: (value: number, rampSeconds: number) => void;
  };
}

const toneMocks = vi.hoisted(() => ({
  gains: [] as GainMockState[],
  connect: vi.fn(),
  disconnect: vi.fn(),
  dispose: vi.fn(),
  rampTo: vi.fn(),
}));

vi.mock('tone', () => {
  class Gain implements GainMockState {
    readonly gain: GainMockState['gain'];

    constructor(options: { gain: number }) {
      this.gain = {
        value: options.gain,
        rampTo: (value, rampSeconds) => {
          this.gain.value = value;
          toneMocks.rampTo(value, rampSeconds);
        },
      };
      toneMocks.gains.push(this);
    }

    connect(destination: unknown) {
      toneMocks.connect(destination);
      return this;
    }

    disconnect() {
      toneMocks.disconnect();
      return this;
    }

    dispose() {
      toneMocks.dispose();
      return this;
    }
  }

  return { Gain };
});

import { AudioPluginRuntimeErrorCode } from './errors';
import { ToneGainPluginRuntimeFactory } from './tone-gain-plugin-runtime';

const FACTORY_OPTIONS = {
  manifestId: 'builtin.gain',
  parameterId: 'gain',
  minValue: 0,
  maxValue: 2,
  defaultValue: 1,
};

describe('ToneGainPluginRuntimeFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toneMocks.gains.length = 0;
  });

  it('매개변수가 없으면 manifest 기본값으로 Gain runtime을 만든다', () => {
    const factory = new ToneGainPluginRuntimeFactory(FACTORY_OPTIONS);

    const runtime = factory.create({ instanceId: 'plugin-1', parameterValues: new Map() });

    expect(factory.manifestId).toBe('builtin.gain');
    expect(runtime.instanceId).toBe('plugin-1');
    expect(runtime.manifestId).toBe('builtin.gain');
    expect(toneMocks.gains[0]?.gain.value).toBe(1);
  });

  it('전달한 초기 Gain 값을 적용한다', () => {
    const factory = new ToneGainPluginRuntimeFactory(FACTORY_OPTIONS);

    factory.create({ instanceId: 'plugin-1', parameterValues: new Map([['gain', 1.5]]) });

    expect(toneMocks.gains[0]?.gain.value).toBe(1.5);
  });

  it('Gain 변경을 짧은 ramp로 적용한다', () => {
    const runtime = new ToneGainPluginRuntimeFactory(FACTORY_OPTIONS).create({
      instanceId: 'plugin-1',
      parameterValues: new Map(),
    });

    runtime.setParameter('gain', 0.25);

    expect(toneMocks.rampTo).toHaveBeenCalledWith(0.25, 0.01);
    expect(toneMocks.gains[0]?.gain.value).toBe(0.25);
  });

  it.each([true, '1', Number.NaN, Number.POSITIVE_INFINITY, -0.1, 2.1])(
    '지원하지 않는 Gain 값 %s를 거부한다',
    value => {
      const factory = new ToneGainPluginRuntimeFactory(FACTORY_OPTIONS);

      expect(() =>
        factory.create({ instanceId: 'plugin-1', parameterValues: new Map([['gain', value]]) })
      ).toThrowError(expect.objectContaining({ code: AudioPluginRuntimeErrorCode.INVALID_PARAMETER_VALUE }));
    }
  );

  it('알 수 없는 Parameter ID 변경을 거부한다', () => {
    const runtime = new ToneGainPluginRuntimeFactory(FACTORY_OPTIONS).create({
      instanceId: 'plugin-1',
      parameterValues: new Map(),
    });

    expect(() => runtime.setParameter('unknown', 1)).toThrowError(
      expect.objectContaining({ code: AudioPluginRuntimeErrorCode.PARAMETER_NOT_FOUND })
    );
  });

  it('알 수 없는 초기 Parameter ID를 거부한다', () => {
    const factory = new ToneGainPluginRuntimeFactory(FACTORY_OPTIONS);

    expect(() => factory.create({ instanceId: 'plugin-1', parameterValues: new Map([['unknown', 1]]) })).toThrowError(
      expect.objectContaining({ code: AudioPluginRuntimeErrorCode.PARAMETER_NOT_FOUND })
    );
    expect(toneMocks.gains).toHaveLength(0);
  });

  it.each([
    { ...FACTORY_OPTIONS, manifestId: '' },
    { ...FACTORY_OPTIONS, parameterId: '' },
    { ...FACTORY_OPTIONS, minValue: 1, maxValue: 1 },
    { ...FACTORY_OPTIONS, defaultValue: 3 },
  ])('잘못된 Factory 설정을 거부한다', options => {
    expect(() => new ToneGainPluginRuntimeFactory(options)).toThrowError(
      expect.objectContaining({ code: AudioPluginRuntimeErrorCode.INVALID_FACTORY_CONFIG })
    );
  });

  it('AudioEngine이 노드를 연결하고 정리할 수 있는 계약을 제공한다', () => {
    const runtime = new ToneGainPluginRuntimeFactory(FACTORY_OPTIONS).create({
      instanceId: 'plugin-1',
      parameterValues: new Map(),
    });

    runtime.connect(runtime.inputNode);
    runtime.disconnect();
    runtime.dispose();

    expect(toneMocks.connect).toHaveBeenCalledWith(runtime.inputNode);
    expect(toneMocks.disconnect).toHaveBeenCalledOnce();
    expect(toneMocks.dispose).toHaveBeenCalledOnce();
  });
});
