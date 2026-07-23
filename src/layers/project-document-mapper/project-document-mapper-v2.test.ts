import { describe, expect, it } from 'vitest';
import { ProjectPluginCompatibilityIssueCode } from '../shared/project-plugin-compatibility';
import type { PluginCatalogEntry } from '../shared/types/plugin-state';
import type { ProjectDocumentV2 } from '../shared/types/project-document.schema';
import {
  ProjectDocumentMappingError,
  ProjectDocumentMappingErrorCode,
  type ProjectDocumentMappingErrorCode as MappingErrorCode,
} from './errors';
import {
  createProjectDocumentFromSession,
  createProjectDocumentV2FromSession,
  createProjectRestoreSnapshotFromDocumentV2,
  type SessionProjectSnapshot,
} from './project-document-mapper';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TRACK_ID = '22222222-2222-4222-8222-222222222222';
const SECOND_TRACK_ID = '33333333-3333-4333-8333-333333333333';
const PLUGIN_INSTANCE_ID = '44444444-4444-4444-8444-444444444444';

const pluginCatalogEntry: PluginCatalogEntry = {
  id: 'builtin.example',
  name: '현재 Plugin 이름',
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
  ],
};

function createSessionSnapshot(): SessionProjectSnapshot {
  return {
    project: { id: PROJECT_ID, name: 'Plugin 프로젝트', revision: 2 },
    tempo: 120,
    masterVolume: 0.8,
    exportStartTime: null,
    exportEndTime: null,
    tracks: new Map([
      [
        TRACK_ID,
        {
          id: TRACK_ID,
          name: '보컬',
          volume: 0.9,
          pan: 0,
          isMuted: false,
          isSoloed: false,
          status: [],
          pluginInstances: [
            {
              id: PLUGIN_INSTANCE_ID,
              manifestSummary: {
                id: pluginCatalogEntry.id,
                name: '저장하지 않을 과거 이름',
                version: pluginCatalogEntry.version,
              },
              isEnabled: false,
              parameters: [
                { id: 'enabled', value: false },
                { id: 'gain', value: 0.5 },
              ],
            },
          ],
          regions: [],
        },
      ],
    ]),
  };
}

function createProjectDocumentV2(): ProjectDocumentV2 {
  return createProjectDocumentV2FromSession({
    session: createSessionSnapshot(),
    audioSources: [],
    pluginCatalog: [pluginCatalogEntry],
  });
}

function expectMappingError(action: () => unknown, code: MappingErrorCode): ProjectDocumentMappingError {
  let thrownError: unknown;

  try {
    action();
  } catch (error) {
    thrownError = error;
  }

  expect(thrownError).toBeInstanceOf(ProjectDocumentMappingError);
  expect(thrownError).toMatchObject({ code });
  return thrownError as ProjectDocumentMappingError;
}

describe('ProjectDocument v2 mapper', () => {
  it('Session Plugin 상태를 호환성 검증 후 v2 문서에 저장한다', () => {
    const document = createProjectDocumentV2();

    expect(document.schemaVersion).toBe(2);
    expect(document.tracks[0]?.pluginInstances).toEqual([
      {
        id: PLUGIN_INSTANCE_ID,
        manifestId: pluginCatalogEntry.id,
        manifestVersion: pluginCatalogEntry.version,
        isEnabled: false,
        parameters: [
          { id: 'gain', value: 0.5 },
          { id: 'enabled', value: false },
        ],
      },
    ]);
    expect(document.tracks[0]?.pluginInstances[0]).not.toHaveProperty('manifestSummary');
  });

  it('저장할 Plugin manifest version이 catalog와 다르면 Session 오류로 거부한다', () => {
    const session = createSessionSnapshot();
    const track = session.tracks.get(TRACK_ID);
    if (!track) {
      throw new Error('테스트 Track을 찾을 수 없습니다.');
    }
    const invalidSession = {
      ...session,
      tracks: new Map([
        [
          TRACK_ID,
          {
            ...track,
            pluginInstances: [
              {
                ...track.pluginInstances[0],
                manifestSummary: { ...track.pluginInstances[0].manifestSummary, version: '1.2.2' },
              },
            ],
          },
        ],
      ]),
    };

    const error = expectMappingError(
      () =>
        createProjectDocumentV2FromSession({
          session: invalidSession,
          audioSources: [],
          pluginCatalog: [pluginCatalogEntry],
        }),
      ProjectDocumentMappingErrorCode.INVALID_SESSION_PROJECT_STATE
    );

    expect(error.details).toMatchObject({
      reason: 'PLUGIN_COMPATIBILITY_FAILED',
      trackId: TRACK_ID,
      issues: [
        {
          code: ProjectPluginCompatibilityIssueCode.MANIFEST_VERSION_MISMATCH,
          actualVersion: '1.2.2',
          expectedVersion: '1.2.3',
        },
      ],
    });
  });

  it('v2 문서를 catalog 정의 순서의 Session Plugin 상태로 복원한다', () => {
    const document = createProjectDocumentV2();
    const pluginInstance = document.tracks[0]?.pluginInstances[0];
    if (!pluginInstance) {
      throw new Error('테스트 Plugin 인스턴스를 찾을 수 없습니다.');
    }
    pluginInstance.parameters.reverse();

    const restored = createProjectRestoreSnapshotFromDocumentV2({
      document,
      pluginCatalog: [pluginCatalogEntry],
    });

    expect(restored.session.tracks.get(TRACK_ID)?.pluginInstances).toEqual([
      {
        id: PLUGIN_INSTANCE_ID,
        manifestSummary: {
          id: pluginCatalogEntry.id,
          name: pluginCatalogEntry.name,
          version: pluginCatalogEntry.version,
        },
        isEnabled: false,
        parameters: [
          { id: 'gain', value: 0.5 },
          { id: 'enabled', value: false },
        ],
      },
    ]);
  });

  it('v1 문서는 v2 복원 경계에서 빈 Plugin 체인으로 마이그레이션한다', () => {
    const session = createSessionSnapshot();
    const documentV1 = createProjectDocumentFromSession({ session, audioSources: [] });

    const restored = createProjectRestoreSnapshotFromDocumentV2({
      document: documentV1,
      pluginCatalog: [pluginCatalogEntry],
    });

    expect(restored.session.tracks.get(TRACK_ID)?.pluginInstances).toEqual([]);
  });

  it('문서의 Plugin manifest가 catalog에 없으면 ProjectDocument 오류로 거부한다', () => {
    const error = expectMappingError(
      () => createProjectRestoreSnapshotFromDocumentV2({ document: createProjectDocumentV2(), pluginCatalog: [] }),
      ProjectDocumentMappingErrorCode.INVALID_PROJECT_DOCUMENT
    );

    expect(error.details).toMatchObject({
      reason: 'PLUGIN_COMPATIBILITY_FAILED',
      trackId: TRACK_ID,
      issues: [{ code: ProjectPluginCompatibilityIssueCode.MANIFEST_NOT_FOUND }],
    });
  });

  it('문서 전체에서 Plugin instance ID가 중복되면 v2 저장을 거부한다', () => {
    const session = createSessionSnapshot();
    const firstTrack = session.tracks.get(TRACK_ID);
    if (!firstTrack) {
      throw new Error('테스트 Track을 찾을 수 없습니다.');
    }
    const sessionWithDuplicateInstanceId = {
      ...session,
      tracks: new Map([
        [TRACK_ID, firstTrack],
        [SECOND_TRACK_ID, { ...firstTrack, id: SECOND_TRACK_ID, pluginInstances: [...firstTrack.pluginInstances] }],
      ]),
    };

    const error = expectMappingError(
      () =>
        createProjectDocumentV2FromSession({
          session: sessionWithDuplicateInstanceId,
          audioSources: [],
          pluginCatalog: [pluginCatalogEntry],
        }),
      ProjectDocumentMappingErrorCode.INVALID_SESSION_PROJECT_STATE
    );

    expect(error.details).toMatchObject({ reason: 'PROJECT_DOCUMENT_SCHEMA_VIOLATION' });
  });

  it('v2 양방향 변환 결과는 Plugin 입력과 참조를 공유하지 않는다', () => {
    const session = createSessionSnapshot();
    const originalPluginInstance = session.tracks.get(TRACK_ID)?.pluginInstances[0];
    if (!originalPluginInstance) {
      throw new Error('테스트 Plugin 인스턴스를 찾을 수 없습니다.');
    }
    const document = createProjectDocumentV2FromSession({
      session,
      audioSources: [],
      pluginCatalog: [pluginCatalogEntry],
    });
    const restored = createProjectRestoreSnapshotFromDocumentV2({
      document,
      pluginCatalog: [pluginCatalogEntry],
    });
    const documentPluginInstance = document.tracks[0]?.pluginInstances[0];
    const restoredPluginInstance = restored.session.tracks.get(TRACK_ID)?.pluginInstances[0];
    if (!documentPluginInstance || !restoredPluginInstance) {
      throw new Error('변환된 Plugin 인스턴스를 찾을 수 없습니다.');
    }

    expect(documentPluginInstance.parameters).not.toBe(originalPluginInstance.parameters);
    expect(restoredPluginInstance.parameters).not.toBe(documentPluginInstance.parameters);
    expect(restoredPluginInstance.manifestSummary).not.toBe(pluginCatalogEntry);
    documentPluginInstance.parameters[0].value = 1.5;

    expect(originalPluginInstance.parameters[1]?.value).toBe(0.5);
    expect(documentPluginInstance.parameters[0]?.value).toBe(1.5);
    expect(pluginCatalogEntry.name).toBe('현재 Plugin 이름');
  });
});
