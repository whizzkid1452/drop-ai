import { describe, expect, it } from 'vitest';
import { PluginHostErrorCode } from './errors';
import { PluginHost } from './plugin-host';

function createManifest(id = 'builtin.gain') {
  return {
    schemaVersion: 1,
    id,
    name: '  Gain  ',
    version: '1.0.0',
    type: 'effect',
    parameters: [
      {
        id: 'gain',
        name: 'Gain',
        type: 'number',
        minValue: 0,
        maxValue: 2,
        defaultValue: 1,
        step: 0.01,
      },
    ],
    dsp: {
      workletModulePath: './gain.worklet.js',
      processorName: 'drop-ai-gain',
    },
    ui: {
      controls: [{ type: 'slider', parameterId: 'gain' }],
    },
  };
}

describe('PluginHost manifest registry', () => {
  it('검증한 manifest를 정규화해 등록한다', () => {
    const host = new PluginHost();

    const registeredManifest = host.registerManifest(createManifest());

    expect(registeredManifest).toMatchObject({ id: 'builtin.gain', name: 'Gain', version: '1.0.0' });
    expect(host.resolveManifest('builtin.gain')).toEqual(registeredManifest);
  });

  it('잘못된 manifest를 typed 오류로 거부하고 registry를 변경하지 않는다', () => {
    const host = new PluginHost();
    const manifest = createManifest();
    manifest.parameters[0].defaultValue = 3;

    expect(() => host.registerManifest(manifest)).toThrowError(
      expect.objectContaining({
        code: PluginHostErrorCode.INVALID_MANIFEST,
        issues: [expect.objectContaining({ path: ['parameters', 0, 'defaultValue'] })],
      })
    );
    expect(host.listManifests()).toEqual([]);
  });

  it('같은 Plugin ID의 중복 등록을 거부하고 기존 manifest를 유지한다', () => {
    const host = new PluginHost();
    host.registerManifest(createManifest());
    const duplicateManifest = { ...createManifest(), name: '다른 이름', version: '2.0.0' };

    expect(() => host.registerManifest(duplicateManifest)).toThrowError(
      expect.objectContaining({
        code: PluginHostErrorCode.MANIFEST_ALREADY_REGISTERED,
        manifestId: 'builtin.gain',
      })
    );
    expect(host.resolveManifest('builtin.gain')).toMatchObject({ name: 'Gain', version: '1.0.0' });
  });

  it('등록 입력의 중첩 객체와 registry가 참조를 공유하지 않는다', () => {
    const host = new PluginHost();
    const manifest = createManifest();
    host.registerManifest(manifest);

    manifest.parameters[0].name = '외부 변경';
    manifest.ui.controls[0].parameterId = 'external-change';

    expect(host.resolveManifest('builtin.gain')).toMatchObject({
      parameters: [{ name: 'Gain' }],
      ui: { controls: [{ parameterId: 'gain' }] },
    });
  });

  it('조회 결과를 변경해도 registry 내부 manifest는 바뀌지 않는다', () => {
    const host = new PluginHost();
    host.registerManifest(createManifest());
    const resolvedManifest = host.resolveManifest('builtin.gain');

    expect(resolvedManifest).not.toBeNull();
    resolvedManifest!.parameters[0].name = '조회 결과 변경';

    expect(host.resolveManifest('builtin.gain')?.parameters[0].name).toBe('Gain');
  });

  it('manifest 목록을 등록 순서로 반환한다', () => {
    const host = new PluginHost();
    host.registerManifest(createManifest('builtin.gain'));
    host.registerManifest({
      ...createManifest('builtin.saturation'),
      name: 'Saturation',
      dsp: {
        workletModulePath: './saturation.worklet.js',
        processorName: 'drop-ai-saturation',
      },
    });

    expect(host.listManifests().map(manifest => manifest.id)).toEqual(['builtin.gain', 'builtin.saturation']);
  });

  it('목록 결과를 변경해도 registry 내부 manifest는 바뀌지 않는다', () => {
    const host = new PluginHost();
    host.registerManifest(createManifest());
    const listedManifests = host.listManifests();
    listedManifests[0]!.parameters[0].name = '목록 결과 변경';

    expect(host.resolveManifest('builtin.gain')?.parameters[0].name).toBe('Gain');
  });

  it('등록되지 않은 Plugin ID 조회는 null을 반환한다', () => {
    const host = new PluginHost();

    expect(host.resolveManifest('builtin.missing')).toBeNull();
  });
});
