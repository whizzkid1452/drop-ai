import { describe, expect, it } from 'vitest';
import type { PluginCatalogEntry } from './types/plugin-state';
import type { ProjectPluginInstance } from './types/project-document.schema';
import {
  ProjectPluginCompatibilityIssueCode,
  validateProjectPluginCompatibility,
} from './project-plugin-compatibility';

const catalogEntry: PluginCatalogEntry = {
  id: 'builtin.example',
  name: 'Example',
  version: '1.2.3',
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
    { id: 'enabled', name: 'Enabled', type: 'boolean', defaultValue: true },
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
};

function createProjectPluginInstance(): ProjectPluginInstance {
  return {
    id: '77777777-7777-4777-8777-777777777777',
    manifestId: catalogEntry.id,
    manifestVersion: catalogEntry.version,
    isEnabled: true,
    parameters: [
      { id: 'mode', value: 'warm' },
      { id: 'gain', value: 0.5 },
      { id: 'enabled', value: false },
    ],
  };
}

function expectIssueCode(instance: ProjectPluginInstance, code: string): void {
  const result = validateProjectPluginCompatibility({ instance, pluginCatalog: [catalogEntry] });

  expect(result).toMatchObject({
    status: 'incompatible',
    issues: expect.arrayContaining([expect.objectContaining({ code })]),
  });
}

describe('Project Plugin compatibility', () => {
  it('manifest와 정확히 맞는 상태를 manifest Parameter 순서의 Session 상태로 바꾼다', () => {
    const instance = createProjectPluginInstance();

    const result = validateProjectPluginCompatibility({ instance, pluginCatalog: [catalogEntry] });

    expect(result).toEqual({
      status: 'compatible',
      pluginInstance: {
        id: instance.id,
        manifestSummary: { id: catalogEntry.id, name: catalogEntry.name, version: catalogEntry.version },
        isEnabled: true,
        parameters: [
          { id: 'gain', value: 0.5 },
          { id: 'enabled', value: false },
          { id: 'mode', value: 'warm' },
        ],
      },
    });
  });

  it('비활성 상태를 호환성 결과에 그대로 보존한다', () => {
    const instance = { ...createProjectPluginInstance(), isEnabled: false };

    const result = validateProjectPluginCompatibility({ instance, pluginCatalog: [catalogEntry] });

    expect(result).toMatchObject({ status: 'compatible', pluginInstance: { isEnabled: false } });
  });

  it('등록되지 않은 manifest를 거부한다', () => {
    const instance = createProjectPluginInstance();

    const result = validateProjectPluginCompatibility({ instance, pluginCatalog: [] });

    expect(result).toMatchObject({
      status: 'incompatible',
      issues: [{ code: ProjectPluginCompatibilityIssueCode.MANIFEST_NOT_FOUND, manifestId: instance.manifestId }],
    });
  });

  it('같은 ID의 catalog 항목이 중복되면 모호한 manifest 선택을 거부한다', () => {
    const instance = createProjectPluginInstance();

    const result = validateProjectPluginCompatibility({
      instance,
      pluginCatalog: [catalogEntry, { ...catalogEntry }],
    });

    expect(result).toMatchObject({
      status: 'incompatible',
      issues: [{ code: ProjectPluginCompatibilityIssueCode.MANIFEST_CATALOG_CONFLICT }],
    });
  });

  it('저장 version과 등록 version이 다르면 정확한 version 불일치로 거부한다', () => {
    const instance = { ...createProjectPluginInstance(), manifestVersion: '1.2.2' };

    const result = validateProjectPluginCompatibility({ instance, pluginCatalog: [catalogEntry] });

    expect(result).toMatchObject({
      status: 'incompatible',
      issues: [
        {
          code: ProjectPluginCompatibilityIssueCode.MANIFEST_VERSION_MISMATCH,
          actualVersion: '1.2.2',
          expectedVersion: '1.2.3',
        },
      ],
    });
  });

  it('catalog의 Parameter 정의 ID가 중복되면 모호한 계약을 거부한다', () => {
    const duplicateDefinitionCatalog = {
      ...catalogEntry,
      parameters: [...catalogEntry.parameters, { ...catalogEntry.parameters[0] }],
    };

    const result = validateProjectPluginCompatibility({
      instance: createProjectPluginInstance(),
      pluginCatalog: [duplicateDefinitionCatalog],
    });

    expect(result).toMatchObject({
      status: 'incompatible',
      issues: [
        {
          code: ProjectPluginCompatibilityIssueCode.PARAMETER_DEFINITION_ID_CONFLICT,
          parameterId: 'gain',
        },
      ],
    });
  });

  it('알 수 없는 Parameter와 누락된 Parameter를 모두 보고한다', () => {
    const instance = {
      ...createProjectPluginInstance(),
      parameters: [
        { id: 'gain', value: 0.5 },
        { id: 'enabled', value: false },
        { id: 'unknown', value: true },
      ],
    };

    const result = validateProjectPluginCompatibility({ instance, pluginCatalog: [catalogEntry] });

    expect(result).toMatchObject({
      status: 'incompatible',
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: ProjectPluginCompatibilityIssueCode.PARAMETER_NOT_FOUND,
          parameterId: 'unknown',
        }),
        expect.objectContaining({ code: ProjectPluginCompatibilityIssueCode.PARAMETER_MISSING, parameterId: 'mode' }),
      ]),
    });
  });

  it('중복 Parameter ID를 거부한다', () => {
    const original = createProjectPluginInstance();
    const instance = { ...original, parameters: [...original.parameters, { id: 'gain', value: 1 }] };

    expectIssueCode(instance, ProjectPluginCompatibilityIssueCode.PARAMETER_ID_CONFLICT);
  });

  it.each([
    ['number type', { id: 'gain', value: '1' }],
    ['number range', { id: 'gain', value: 3 }],
    ['finite number', { id: 'gain', value: Number.NaN }],
    ['boolean type', { id: 'enabled', value: 1 }],
    ['enum option', { id: 'mode', value: 'missing' }],
  ])('유효하지 않은 %s 값을 거부한다', (_, invalidParameter) => {
    const original = createProjectPluginInstance();
    const instance = {
      ...original,
      parameters: original.parameters.map(parameter =>
        parameter.id === invalidParameter.id ? invalidParameter : parameter
      ),
    };

    expectIssueCode(instance, ProjectPluginCompatibilityIssueCode.INVALID_PARAMETER_VALUE);
  });

  it('반환한 manifest 요약과 Parameter 배열은 입력과 참조를 공유하지 않는다', () => {
    const instance = createProjectPluginInstance();
    const result = validateProjectPluginCompatibility({ instance, pluginCatalog: [catalogEntry] });
    if (result.status !== 'compatible') {
      throw new Error('호환 가능한 fixture가 거부되었습니다.');
    }

    expect(result.pluginInstance.manifestSummary).not.toBe(catalogEntry);
    expect(result.pluginInstance.parameters).not.toBe(instance.parameters);
  });
});
