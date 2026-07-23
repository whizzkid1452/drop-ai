import { beforeEach, describe, expect, it, vi } from 'vitest';

interface DistortionMockState {
  distortion: number;
  oversample: 'none' | '2x' | '4x';
}

const toneMocks = vi.hoisted(() => ({
  distortions: [] as DistortionMockState[],
  connect: vi.fn(),
  disconnect: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock('tone', () => {
  class Distortion implements DistortionMockState {
    distortion: number;
    oversample: 'none' | '2x' | '4x';

    constructor(options: { distortion: number; oversample: 'none' | '2x' | '4x' }) {
      this.distortion = options.distortion;
      this.oversample = options.oversample;
      toneMocks.distortions.push(this);
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

  return { Distortion };
});

import { AudioPluginRuntimeErrorCode } from './errors';
import { ToneSaturationPluginRuntimeFactory } from './tone-saturation-plugin-runtime';

const FACTORY_OPTIONS = {
  manifestId: 'builtin.saturation',
  parameterId: 'drive',
  minValue: 0,
  maxValue: 1,
  defaultValue: 0.2,
} as const;

describe('ToneSaturationPluginRuntimeFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toneMocks.distortions.length = 0;
  });

  it('매개변수가 없으면 manifest 기본값과 2x 오버샘플링으로 runtime을 만든다', () => {
    const factory = new ToneSaturationPluginRuntimeFactory(FACTORY_OPTIONS);

    const runtime = factory.create({ instanceId: 'plugin-1', parameterValues: new Map() });

    expect(factory.manifestId).toBe('builtin.saturation');
    expect(runtime.instanceId).toBe('plugin-1');
    expect(runtime.manifestId).toBe('builtin.saturation');
    expect(toneMocks.distortions[0]).toMatchObject({ distortion: 0.2, oversample: '2x' });
  });

  it('전달한 초기 drive 값을 적용한다', () => {
    const factory = new ToneSaturationPluginRuntimeFactory(FACTORY_OPTIONS);

    factory.create({ instanceId: 'plugin-1', parameterValues: new Map([['drive', 0.6]]) });

    expect(toneMocks.distortions[0]?.distortion).toBe(0.6);
  });

  it('drive 값을 변경한다', () => {
    const runtime = new ToneSaturationPluginRuntimeFactory(FACTORY_OPTIONS).create({
      instanceId: 'plugin-1',
      parameterValues: new Map(),
    });

    runtime.setParameter('drive', 0.75);

    expect(toneMocks.distortions[0]?.distortion).toBe(0.75);
  });

  it.each([true, '0.5', Number.NaN, Number.POSITIVE_INFINITY, -0.1, 1.1])(
    '지원하지 않는 drive 값 %s를 거부한다',
    value => {
      const factory = new ToneSaturationPluginRuntimeFactory(FACTORY_OPTIONS);

      expect(() =>
        factory.create({ instanceId: 'plugin-1', parameterValues: new Map([['drive', value]]) })
      ).toThrowError(expect.objectContaining({ code: AudioPluginRuntimeErrorCode.INVALID_PARAMETER_VALUE }));
    }
  );

  it('알 수 없는 Parameter ID를 거부한다', () => {
    const factory = new ToneSaturationPluginRuntimeFactory(FACTORY_OPTIONS);

    expect(() => factory.create({ instanceId: 'plugin-1', parameterValues: new Map([['unknown', 0.5]]) })).toThrowError(
      expect.objectContaining({ code: AudioPluginRuntimeErrorCode.PARAMETER_NOT_FOUND })
    );
  });

  it.each([
    { ...FACTORY_OPTIONS, manifestId: '' },
    { ...FACTORY_OPTIONS, parameterId: '' },
    { ...FACTORY_OPTIONS, minValue: 1, maxValue: 1 },
    { ...FACTORY_OPTIONS, defaultValue: 2 },
  ])('잘못된 Factory 설정을 거부한다', options => {
    expect(() => new ToneSaturationPluginRuntimeFactory(options)).toThrowError(
      expect.objectContaining({ code: AudioPluginRuntimeErrorCode.INVALID_FACTORY_CONFIG })
    );
  });

  it('AudioEngine이 노드를 연결하고 정리할 수 있는 계약을 제공한다', () => {
    const runtime = new ToneSaturationPluginRuntimeFactory(FACTORY_OPTIONS).create({
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
