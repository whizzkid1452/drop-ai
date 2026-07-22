import { describe, expect, it } from 'vitest';
import { PROJECT_DOCUMENT_SCHEMA_VERSION, ProjectDocumentSchema } from './project-document.schema';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const SOURCE_ID = '22222222-2222-4222-8222-222222222222';
const TRACK_ID = '33333333-3333-4333-8333-333333333333';
const REGION_ID = '44444444-4444-4444-8444-444444444444';

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
