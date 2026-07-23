import { describe, expect, it } from 'vitest';
import { createPluginManifestSummary, PluginManifestSchema, validatePluginManifest } from './plugin-manifest.schema';

function createValidManifest() {
  return {
    schemaVersion: 1,
    id: 'builtin.channel-tools',
    name: 'Channel Tools',
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
      {
        id: 'bypass',
        name: 'Bypass',
        type: 'boolean',
        defaultValue: false,
      },
      {
        id: 'mode',
        name: 'Mode',
        type: 'enum',
        defaultValue: 'clean',
        options: [
          { value: 'clean', name: 'Clean' },
          { value: 'warm', name: 'Warm' },
        ],
      },
    ],
    dsp: {
      workletModulePath: './channel-tools.worklet.js',
      processorName: 'drop-ai-channel-tools',
    },
    ui: {
      controls: [
        { type: 'slider', parameterId: 'gain' },
        { type: 'toggle', parameterId: 'bypass' },
        { type: 'select', parameterId: 'mode' },
      ],
    },
  };
}

describe('PluginManifestSchema', () => {
  it('숫자·boolean·enum 매개변수와 대응 UI control을 허용한다', () => {
    expect(PluginManifestSchema.parse(createValidManifest())).toEqual(createValidManifest());
  });

  it('정의되지 않은 필드를 거부한다', () => {
    const manifest = { ...createValidManifest(), entrypoint: 'unsafe.js' };

    expect(PluginManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it('namespace가 없는 Plugin ID를 거부한다', () => {
    ['gain', 'channel-tools'].forEach(id => {
      const manifest = { ...createValidManifest(), id };

      expect(PluginManifestSchema.safeParse(manifest).success).toBe(false);
    });
  });

  it('Semantic Versioning 형식이 아닌 version을 거부한다', () => {
    ['1.0', '01.0.0'].forEach(version => {
      const manifest = { ...createValidManifest(), version };

      expect(PluginManifestSchema.safeParse(manifest).success).toBe(false);
    });
  });

  it('URL이나 상위 경로를 가리키는 Worklet module path를 거부한다', () => {
    const invalidPaths = ['https://example.com/plugin.js', '../plugin.js', '/plugin.js'];

    invalidPaths.forEach(workletModulePath => {
      const manifest = createValidManifest();
      manifest.dsp.workletModulePath = workletModulePath;

      expect(PluginManifestSchema.safeParse(manifest).success).toBe(false);
    });
  });

  it('중복 Parameter ID를 거부한다', () => {
    const manifest = createValidManifest();
    manifest.parameters[1].id = 'gain';

    expect(PluginManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it('숫자 기본값이 범위 밖이면 거부한다', () => {
    const manifest = createValidManifest();
    manifest.parameters[0].defaultValue = 3;

    expect(PluginManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it('숫자 최댓값이 최솟값보다 크지 않으면 거부한다', () => {
    const manifest = createValidManifest();
    manifest.parameters[0].maxValue = 0;

    expect(PluginManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it('enum 기본값이 option에 없으면 거부한다', () => {
    const manifest = createValidManifest();
    manifest.parameters[2].defaultValue = 'missing';

    expect(PluginManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it('enum option value가 중복되면 거부한다', () => {
    const manifest = createValidManifest();
    manifest.parameters[2].options![1]!.value = 'clean';

    expect(PluginManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it('존재하지 않는 Parameter를 참조하는 UI control을 거부한다', () => {
    const manifest = createValidManifest();
    manifest.ui.controls[0].parameterId = 'missing';

    expect(PluginManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it('Parameter type과 맞지 않는 UI control을 거부한다', () => {
    const manifest = createValidManifest();
    manifest.ui.controls[0].type = 'toggle';

    expect(PluginManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it('같은 Parameter를 중복 표시하는 UI control을 거부한다', () => {
    const manifest = createValidManifest();
    manifest.ui.controls[1].parameterId = 'gain';

    expect(PluginManifestSchema.safeParse(manifest).success).toBe(false);
  });
});

describe('Plugin Manifest 판독', () => {
  it('검증 성공 시 정규화된 Manifest를 반환한다', () => {
    const manifest = createValidManifest();
    manifest.name = '  Channel Tools  ';

    expect(validatePluginManifest(manifest)).toMatchObject({
      status: 'valid',
      manifest: { name: 'Channel Tools' },
      issues: [],
    });
  });

  it('검증 실패 시 경로를 포함한 issue를 반환한다', () => {
    const manifest = createValidManifest();
    manifest.parameters[0].defaultValue = 3;

    expect(validatePluginManifest(manifest)).toMatchObject({
      status: 'invalid',
      manifest: null,
      issues: [
        {
          code: 'custom',
          path: ['parameters', 0, 'defaultValue'],
        },
      ],
    });
  });

  it('Session용 Manifest 요약을 새 객체로 만든다', () => {
    const parsedManifest = PluginManifestSchema.parse(createValidManifest());
    const summary = createPluginManifestSummary(parsedManifest);

    expect(summary).toEqual({ id: 'builtin.channel-tools', name: 'Channel Tools', version: '1.0.0' });
    expect(summary).not.toBe(parsedManifest);
  });
});
