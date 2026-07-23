import { describe, expect, it } from 'vitest';
import {
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V2,
  ProjectDocumentSchema,
  ProjectDocumentV2Schema,
} from './project-document.schema';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const SOURCE_ID = '22222222-2222-4222-8222-222222222222';
const TRACK_ID = '33333333-3333-4333-8333-333333333333';
const REGION_ID = '44444444-4444-4444-8444-444444444444';
const PLUGIN_INSTANCE_ID = '55555555-5555-4555-8555-555555555555';

function createValidProjectDocument() {
  return {
    documentType: 'drop-ai-project',
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
    project: {
      id: PROJECT_ID,
      name: '새 프로젝트',
      revision: 0,
    },
    timeline: {
      timeUnit: 'seconds',
      tempoBpm: 120,
    },
    mixer: {
      masterVolume: 1,
    },
    exportRange: {
      startTimeSeconds: 2,
      endTimeSeconds: 8,
    },
    audioSources: [
      {
        id: SOURCE_ID,
        fileName: 'voice.wav',
        mimeType: 'audio/wav',
        byteLength: 1_024,
        durationSeconds: 10,
      },
    ],
    tracks: [
      {
        id: TRACK_ID,
        name: 'Voice',
        volume: 0.8,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        regions: [
          {
            id: REGION_ID,
            sourceId: SOURCE_ID,
            startTimeSeconds: 2,
            sourceStartTimeSeconds: 1,
            durationSeconds: 4,
          },
        ],
      },
    ],
  };
}

function createValidProjectDocumentV2() {
  const document = createValidProjectDocument();
  return {
    ...document,
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V2,
    tracks: document.tracks.map(track => ({
      ...track,
      pluginInstances: [
        {
          id: PLUGIN_INSTANCE_ID,
          manifestId: 'builtin.gain',
          manifestVersion: '1.0.0',
          isEnabled: true,
          parameters: [{ id: 'gain', value: 1.25 }],
        },
      ],
    })),
  };
}

function getValidationIssuePaths(document: unknown): string[] {
  const result = ProjectDocumentSchema.safeParse(document);
  if (result.success) {
    throw new Error('검증 실패를 예상했지만 문서가 통과했습니다.');
  }

  return result.error.issues.map(issue => issue.path.join('.'));
}

describe('ProjectDocumentSchema', () => {
  it('빈 v1 프로젝트를 검증한다', () => {
    const document = createValidProjectDocument();

    expect(
      ProjectDocumentSchema.safeParse({
        ...document,
        exportRange: null,
        audioSources: [],
        tracks: [],
      }).success
    ).toBe(true);
  });

  it('v1 프로젝트 문서는 JSON 왕복 뒤에도 같은 값으로 검증된다', () => {
    const document = createValidProjectDocument();

    const parsed = ProjectDocumentSchema.parse(JSON.parse(JSON.stringify(document)));

    expect(parsed).toEqual(document);
  });

  it('File과 임시 URL 같은 런타임 필드를 거부한다', () => {
    const document = createValidProjectDocument();
    const documentWithRuntimeFields = {
      ...document,
      audioSources: [{ ...document.audioSources[0], file: new File([], 'voice.wav'), url: 'blob:runtime-url' }],
      tracks: [
        {
          ...document.tracks[0],
          regions: [{ ...document.tracks[0].regions[0], audioFileUrl: 'blob:runtime-url' }],
        },
      ],
    };

    expect(ProjectDocumentSchema.safeParse(documentWithRuntimeFields).success).toBe(false);
  });

  it('참조되지 않는 Source ID를 가진 Region을 거부한다', () => {
    const document = createValidProjectDocument();
    document.tracks[0].regions[0].sourceId = '55555555-5555-4555-8555-555555555555';

    expect(getValidationIssuePaths(document)).toContain('tracks.0.regions.0.sourceId');
  });

  it('Source, Track, Region ID 중복을 각각 거부한다', () => {
    const document = createValidProjectDocument();
    const duplicateSourceDocument = {
      ...document,
      audioSources: [...document.audioSources, { ...document.audioSources[0] }],
    };
    const duplicateTrackDocument = {
      ...document,
      tracks: [...document.tracks, { ...document.tracks[0], regions: [] }],
    };
    const duplicateRegionDocument = {
      ...document,
      tracks: [
        {
          ...document.tracks[0],
          regions: [...document.tracks[0].regions, { ...document.tracks[0].regions[0] }],
        },
      ],
    };

    expect(getValidationIssuePaths(duplicateSourceDocument)).toContain('audioSources.1.id');
    expect(getValidationIssuePaths(duplicateTrackDocument)).toContain('tracks.1.id');
    expect(getValidationIssuePaths(duplicateRegionDocument)).toContain('tracks.0.regions.1.id');
  });

  it('Source 길이를 모르면 Region 범위를 허용하고, 알면 범위를 넘지 못하게 한다', () => {
    const document = createValidProjectDocument();
    const unknownDurationDocument = {
      ...document,
      audioSources: [{ ...document.audioSources[0], durationSeconds: null }],
    };
    const outOfSourceRangeDocument = {
      ...document,
      tracks: [
        {
          ...document.tracks[0],
          regions: [
            {
              ...document.tracks[0].regions[0],
              sourceStartTimeSeconds: 8,
              durationSeconds: 3,
            },
          ],
        },
      ],
    };

    expect(ProjectDocumentSchema.safeParse(unknownDurationDocument).success).toBe(true);
    expect(getValidationIssuePaths(outOfSourceRangeDocument)).toContain('tracks.0.regions.0.durationSeconds');
  });

  it('부동소수점 덧셈 오차만 있는 Source 범위를 허용한다', () => {
    const document = createValidProjectDocument();
    const floatingPointBoundaryDocument = {
      ...document,
      audioSources: [{ ...document.audioSources[0], durationSeconds: 0.3 }],
      tracks: [
        {
          ...document.tracks[0],
          regions: [
            {
              ...document.tracks[0].regions[0],
              sourceStartTimeSeconds: 0.1,
              durationSeconds: 0.2,
            },
          ],
        },
      ],
    };

    expect(ProjectDocumentSchema.safeParse(floatingPointBoundaryDocument).success).toBe(true);
  });

  it('현재 Session이 허용하는 길이 0 Region과 빈 Export 범위를 보존한다', () => {
    const document = createValidProjectDocument();
    const zeroLengthStateDocument = {
      ...document,
      exportRange: { startTimeSeconds: 2, endTimeSeconds: 2 },
      audioSources: [{ ...document.audioSources[0], durationSeconds: 0 }],
      tracks: [
        {
          ...document.tracks[0],
          regions: [
            {
              ...document.tracks[0].regions[0],
              sourceStartTimeSeconds: 0,
              durationSeconds: 0,
            },
          ],
        },
      ],
    };

    expect(ProjectDocumentSchema.safeParse(zeroLengthStateDocument).success).toBe(true);
  });

  it('Region의 타임라인 끝 시각을 유한수로 계산할 수 없는 문서를 거부한다', () => {
    const document = createValidProjectDocument();
    const overflowDocument = {
      ...document,
      audioSources: [{ ...document.audioSources[0], durationSeconds: null }],
      tracks: [
        {
          ...document.tracks[0],
          regions: [
            {
              ...document.tracks[0].regions[0],
              startTimeSeconds: Number.MAX_VALUE,
              durationSeconds: Number.MAX_VALUE,
            },
          ],
        },
      ],
    };

    expect(getValidationIssuePaths(overflowDocument)).toContain('tracks.0.regions.0.durationSeconds');
  });

  it('Source 길이를 몰라도 Region의 원본 끝 시각을 유한수로 계산할 수 없으면 거부한다', () => {
    const document = createValidProjectDocument();
    const overflowDocument = {
      ...document,
      audioSources: [{ ...document.audioSources[0], durationSeconds: null }],
      tracks: [
        {
          ...document.tracks[0],
          regions: [
            {
              ...document.tracks[0].regions[0],
              startTimeSeconds: 0,
              sourceStartTimeSeconds: Number.MAX_VALUE,
              durationSeconds: Number.MAX_VALUE,
            },
          ],
        },
      ],
    };

    expect(getValidationIssuePaths(overflowDocument)).toContain('tracks.0.regions.0.durationSeconds');
  });

  it('문서 식별자, 버전, 시간 단위와 수치 범위를 엄격하게 검증한다', () => {
    const invalidDocuments = [
      { ...createValidProjectDocument(), documentType: 'other-project' },
      { ...createValidProjectDocument(), schemaVersion: 2 },
      {
        ...createValidProjectDocument(),
        timeline: { ...createValidProjectDocument().timeline, timeUnit: 'samples' },
      },
      {
        ...createValidProjectDocument(),
        mixer: { masterVolume: 1.1 },
      },
      {
        ...createValidProjectDocument(),
        exportRange: { startTimeSeconds: 8, endTimeSeconds: 7 },
      },
      {
        ...createValidProjectDocument(),
        tracks: [{ ...createValidProjectDocument().tracks[0], pan: -1.1 }],
      },
      {
        ...createValidProjectDocument(),
        tracks: [
          {
            ...createValidProjectDocument().tracks[0],
            regions: [{ ...createValidProjectDocument().tracks[0].regions[0], durationSeconds: -1 }],
          },
        ],
      },
      {
        ...createValidProjectDocument(),
        timeline: { ...createValidProjectDocument().timeline, tempoBpm: Number.POSITIVE_INFINITY },
      },
      {
        ...createValidProjectDocument(),
        tracks: [
          {
            ...createValidProjectDocument().tracks[0],
            regions: [{ ...createValidProjectDocument().tracks[0].regions[0], startTimeSeconds: Number.NaN }],
          },
        ],
      },
    ];

    invalidDocuments.forEach(document => {
      expect(ProjectDocumentSchema.safeParse(document).success).toBe(false);
    });
  });
});

describe('ProjectDocumentV2Schema', () => {
  it('Plugin 인스턴스와 Parameter 값을 JSON 왕복 가능한 값으로 검증한다', () => {
    const document = createValidProjectDocumentV2();

    const parsed = ProjectDocumentV2Schema.parse(JSON.parse(JSON.stringify(document)));

    expect(parsed).toEqual(document);
  });

  it('v1은 Plugin 필드를 거부하고 v2는 Track별 Plugin 배열을 요구한다', () => {
    const v1WithPluginState = {
      ...createValidProjectDocument(),
      tracks: createValidProjectDocumentV2().tracks,
    };
    const v2WithoutPluginState = {
      ...createValidProjectDocumentV2(),
      tracks: createValidProjectDocument().tracks,
    };

    expect(ProjectDocumentSchema.safeParse(v1WithPluginState).success).toBe(false);
    expect(ProjectDocumentV2Schema.safeParse(v2WithoutPluginState).success).toBe(false);
  });

  it('boolean·유한 number·문자열 Parameter 값만 허용한다', () => {
    const document = createValidProjectDocumentV2();
    const instance = document.tracks[0].pluginInstances[0];
    const validValues = [false, 0.5, 'warm'];

    validValues.forEach(value => {
      const candidate = {
        ...document,
        tracks: [
          {
            ...document.tracks[0],
            pluginInstances: [{ ...instance, parameters: [{ id: 'value', value }] }],
          },
        ],
      };
      expect(ProjectDocumentV2Schema.safeParse(candidate).success).toBe(true);
    });

    ['', Number.NaN, Number.POSITIVE_INFINITY, 'x'.repeat(256), null, { value: 1 }].forEach(value => {
      const candidate = {
        ...document,
        tracks: [
          {
            ...document.tracks[0],
            pluginInstances: [{ ...instance, parameters: [{ id: 'value', value }] }],
          },
        ],
      };
      expect(ProjectDocumentV2Schema.safeParse(candidate).success).toBe(false);
    });
  });

  it('Plugin instance ID와 instance 내부 Parameter ID 중복을 거부한다', () => {
    const document = createValidProjectDocumentV2();
    const instance = document.tracks[0].pluginInstances[0];
    const duplicateInstanceDocument = {
      ...document,
      tracks: [
        {
          ...document.tracks[0],
          pluginInstances: [instance, { ...instance }],
        },
      ],
    };
    const duplicateParameterDocument = {
      ...document,
      tracks: [
        {
          ...document.tracks[0],
          pluginInstances: [
            {
              ...instance,
              parameters: [instance.parameters[0], { ...instance.parameters[0] }],
            },
          ],
        },
      ],
    };

    expect(getV2ValidationIssuePaths(duplicateInstanceDocument)).toContain('tracks.0.pluginInstances.1.id');
    expect(getV2ValidationIssuePaths(duplicateParameterDocument)).toContain(
      'tracks.0.pluginInstances.0.parameters.1.id'
    );
  });

  it('다른 Track에서도 같은 Plugin instance ID를 다시 사용할 수 없다', () => {
    const document = createValidProjectDocumentV2();
    const duplicateTrackDocument = {
      ...document,
      tracks: [
        document.tracks[0],
        {
          ...document.tracks[0],
          id: '66666666-6666-4666-8666-666666666666',
          regions: [],
        },
      ],
    };

    expect(getV2ValidationIssuePaths(duplicateTrackDocument)).toContain('tracks.1.pluginInstances.0.id');
  });

  it('Plugin Runtime 구현 필드를 문서에 저장하지 못하게 한다', () => {
    const document = createValidProjectDocumentV2();
    const instance = document.tracks[0].pluginInstances[0];
    const runtimeFieldDocument = {
      ...document,
      tracks: [
        {
          ...document.tracks[0],
          pluginInstances: [{ ...instance, runtime: { connect: 'function' } }],
        },
      ],
    };

    expect(ProjectDocumentV2Schema.safeParse(runtimeFieldDocument).success).toBe(false);
  });
});

function getV2ValidationIssuePaths(document: unknown): string[] {
  const result = ProjectDocumentV2Schema.safeParse(document);
  if (result.success) {
    throw new Error('검증 실패를 예상했지만 v2 문서가 통과했습니다.');
  }

  return result.error.issues.map(issue => issue.path.join('.'));
}
