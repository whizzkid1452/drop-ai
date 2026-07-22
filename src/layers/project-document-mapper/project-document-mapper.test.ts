import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { ProjectDocumentReadError, ProjectDocumentReadErrorCode } from '../shared/types/project-document-reader';
import { REGION_STATUS, TRACK_STATUS } from '../shared/types/statusTypes';
import type { ProjectAudioSource, ProjectDocument } from '../shared/types/project-document.schema';
import {
  ProjectDocumentMappingError,
  ProjectDocumentMappingErrorCode,
  type ProjectDocumentMappingErrorCode as MappingErrorCode,
} from './errors';
import {
  createProjectDocumentFromSession,
  createProjectRestoreSnapshotFromDocument,
  type SessionProjectSnapshot,
} from './project-document-mapper';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const SOURCE_ID = '22222222-2222-4222-8222-222222222222';
const SECOND_SOURCE_ID = '33333333-3333-4333-8333-333333333333';
const TRACK_ID = '44444444-4444-4444-8444-444444444444';
const SECOND_TRACK_ID = '55555555-5555-4555-8555-555555555555';
const REGION_ID = '66666666-6666-4666-8666-666666666666';
const SECOND_REGION_ID = '77777777-7777-4777-8777-777777777777';

function createAudioSources(): ProjectAudioSource[] {
  return [
    {
      id: SOURCE_ID,
      fileName: 'voice.wav',
      mimeType: 'audio/wav',
      byteLength: 4,
      durationSeconds: 10,
    },
    {
      id: SECOND_SOURCE_ID,
      fileName: 'unused.wav',
      mimeType: 'audio/wav',
      byteLength: 8,
      durationSeconds: null,
    },
  ];
}

function createSessionSnapshot(): SessionProjectSnapshot {
  return {
    project: { id: PROJECT_ID, name: '테스트 프로젝트', revision: 3 },
    tempo: 128,
    masterVolume: 0.75,
    exportStartTime: 1,
    exportEndTime: 9,
    tracks: new Map([
      [
        TRACK_ID,
        {
          id: TRACK_ID,
          name: '보컬',
          volume: 0.8,
          pan: -0.25,
          isMuted: true,
          isSoloed: false,
          status: [TRACK_STATUS.RECORD_ARMED],
          regions: [
            {
              id: REGION_ID,
              sourceId: SOURCE_ID,
              startTime: 2,
              endTime: 5.5,
              sourceStartTime: 0.5,
              duration: 3.5,
              status: [REGION_STATUS.SELECTED],
            },
            {
              id: SECOND_REGION_ID,
              sourceId: SOURCE_ID,
              startTime: 6,
              endTime: 7,
              sourceStartTime: 4,
              duration: 1,
              status: [REGION_STATUS.DRAGGING],
            },
          ],
        },
      ],
      [
        SECOND_TRACK_ID,
        {
          id: SECOND_TRACK_ID,
          name: '반주',
          volume: 1,
          pan: 0.5,
          isMuted: false,
          isSoloed: true,
          status: [TRACK_STATUS.SOLOED],
          regions: [],
        },
      ],
    ]),
  };
}

function createProjectDocument(): ProjectDocument {
  return createProjectDocumentFromSession({
    session: createSessionSnapshot(),
    audioSources: createAudioSources(),
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

describe('ProjectDocument mapper', () => {
  it('Session의 저장 대상 필드를 ProjectDocument v1로 변환한다', () => {
    const document = createProjectDocument();

    expect(document).toEqual({
      documentType: 'drop-ai-project',
      schemaVersion: 1,
      project: { id: PROJECT_ID, name: '테스트 프로젝트', revision: 3 },
      timeline: { timeUnit: 'seconds', tempoBpm: 128 },
      mixer: { masterVolume: 0.75 },
      exportRange: { startTimeSeconds: 1, endTimeSeconds: 9 },
      audioSources: createAudioSources(),
      tracks: [
        {
          id: TRACK_ID,
          name: '보컬',
          volume: 0.8,
          pan: -0.25,
          isMuted: true,
          isSoloed: false,
          regions: [
            {
              id: REGION_ID,
              sourceId: SOURCE_ID,
              startTimeSeconds: 2,
              sourceStartTimeSeconds: 0.5,
              durationSeconds: 3.5,
            },
            {
              id: SECOND_REGION_ID,
              sourceId: SOURCE_ID,
              startTimeSeconds: 6,
              sourceStartTimeSeconds: 4,
              durationSeconds: 1,
            },
          ],
        },
        {
          id: SECOND_TRACK_ID,
          name: '반주',
          volume: 1,
          pan: 0.5,
          isMuted: false,
          isSoloed: true,
          regions: [],
        },
      ],
    });
  });

  it('Track·Region status와 Region endTime을 문서에 저장하지 않는다', () => {
    const document = createProjectDocument();

    expect(document.tracks[0]).not.toHaveProperty('status');
    expect(document.tracks[0].regions[0]).not.toHaveProperty('status');
    expect(document.tracks[0].regions[0]).not.toHaveProperty('endTime');
  });

  it('참조되지 않은 committed Source와 입력 순서를 보존한다', () => {
    const document = createProjectDocument();

    expect(document.audioSources.map(source => source.id)).toEqual([SOURCE_ID, SECOND_SOURCE_ID]);
    expect(document.tracks.map(track => track.id)).toEqual([TRACK_ID, SECOND_TRACK_ID]);
    expect(document.tracks[0].regions.map(region => region.id)).toEqual([REGION_ID, SECOND_REGION_ID]);
  });

  it('Export 범위의 시작과 끝이 모두 null이면 null로 저장한다', () => {
    const session = { ...createSessionSnapshot(), exportStartTime: null, exportEndTime: null };

    expect(createProjectDocumentFromSession({ session, audioSources: createAudioSources() }).exportRange).toBeNull();
  });

  it('Export 범위 한쪽만 null이면 손실 없이 저장할 수 없으므로 거부한다', () => {
    const session = { ...createSessionSnapshot(), exportEndTime: null };

    const error = expectMappingError(
      () => createProjectDocumentFromSession({ session, audioSources: createAudioSources() }),
      ProjectDocumentMappingErrorCode.INVALID_SESSION_PROJECT_STATE
    );
    expect(error.details).toMatchObject({ reason: 'PARTIAL_EXPORT_RANGE' });
  });

  it('Export 범위의 시작만 null이어도 손실 없이 저장할 수 없으므로 거부한다', () => {
    const session = { ...createSessionSnapshot(), exportStartTime: null };

    const error = expectMappingError(
      () => createProjectDocumentFromSession({ session, audioSources: createAudioSources() }),
      ProjectDocumentMappingErrorCode.INVALID_SESSION_PROJECT_STATE
    );
    expect(error.details).toMatchObject({ reason: 'PARTIAL_EXPORT_RANGE' });
  });

  it('Track Map key와 Track ID가 다르면 거부한다', () => {
    const session = createSessionSnapshot();
    const track = session.tracks.get(TRACK_ID);
    if (!track) {
      throw new Error('테스트 Track을 찾을 수 없습니다.');
    }
    const mismatchedSession = { ...session, tracks: new Map([['wrong-map-key', track]]) };

    const error = expectMappingError(
      () => createProjectDocumentFromSession({ session: mismatchedSession, audioSources: createAudioSources() }),
      ProjectDocumentMappingErrorCode.INVALID_SESSION_PROJECT_STATE
    );
    expect(error.details).toMatchObject({ mapKey: 'wrong-map-key', reason: 'TRACK_ID_MISMATCH', trackId: TRACK_ID });
  });

  it('Region endTime이 계산값과 1e-9초보다 크게 다르면 거부한다', () => {
    const session = createSessionSnapshot();
    const track = session.tracks.get(TRACK_ID);
    if (!track) {
      throw new Error('테스트 Track을 찾을 수 없습니다.');
    }
    const region = track.regions[0];
    const mismatchedRegion = { ...region, endTime: region.endTime + 2e-9 };
    const mismatchedSession = {
      ...session,
      tracks: new Map([[TRACK_ID, { ...track, regions: [mismatchedRegion] }]]),
    };

    const error = expectMappingError(
      () => createProjectDocumentFromSession({ session: mismatchedSession, audioSources: createAudioSources() }),
      ProjectDocumentMappingErrorCode.INVALID_SESSION_PROJECT_STATE
    );
    expect(error.details).toMatchObject({ reason: 'REGION_END_TIME_MISMATCH', regionId: REGION_ID });
  });

  it('Region endTime의 절대 차이가 1e-9초 이하이면 허용한다', () => {
    const session = createSessionSnapshot();
    const track = session.tracks.get(TRACK_ID);
    if (!track) {
      throw new Error('테스트 Track을 찾을 수 없습니다.');
    }
    const region = {
      ...track.regions[0],
      startTime: 0.1,
      endTime: 0.3,
      duration: 0.2,
    };
    const floatingPointSession = {
      ...session,
      tracks: new Map([[TRACK_ID, { ...track, regions: [region] }]]),
    };

    expect(
      createProjectDocumentFromSession({ session: floatingPointSession, audioSources: createAudioSources() }).tracks[0]
        .regions[0]
    ).toMatchObject({ startTimeSeconds: 0.1, durationSeconds: 0.2 });
  });

  it('큰 시간값에서 숫자 크기에 비례한 부동소수점 오차를 허용한다', () => {
    const session = createSessionSnapshot();
    const track = session.tracks.get(TRACK_ID);
    if (!track) {
      throw new Error('테스트 Track을 찾을 수 없습니다.');
    }
    const startTime = 5_278_453.819016906;
    const endTime = 15_265_389.086999921;
    const region = {
      ...track.regions[0],
      startTime,
      endTime,
      duration: endTime - startTime,
    };
    const largeTimelineSession = {
      ...session,
      tracks: new Map([[TRACK_ID, { ...track, regions: [region] }]]),
    };
    const audioSources = createAudioSources().map(source =>
      source.id === SOURCE_ID ? { ...source, durationSeconds: null } : source
    );

    expect(
      createProjectDocumentFromSession({ session: largeTimelineSession, audioSources }).tracks[0].regions[0]
    ).toMatchObject({ startTimeSeconds: startTime, durationSeconds: endTime - startTime });
  });

  it('Region endTime 계산 결과가 유한수가 아니면 거부한다', () => {
    const session = createSessionSnapshot();
    const track = session.tracks.get(TRACK_ID);
    if (!track) {
      throw new Error('테스트 Track을 찾을 수 없습니다.');
    }
    const region = {
      ...track.regions[0],
      startTime: Number.MAX_VALUE,
      endTime: Number.MAX_VALUE,
      duration: Number.MAX_VALUE,
    };
    const overflowSession = {
      ...session,
      tracks: new Map([[TRACK_ID, { ...track, regions: [region] }]]),
    };

    const error = expectMappingError(
      () => createProjectDocumentFromSession({ session: overflowSession, audioSources: createAudioSources() }),
      ProjectDocumentMappingErrorCode.INVALID_SESSION_PROJECT_STATE
    );
    expect(error.details).toMatchObject({ reason: 'REGION_END_TIME_NOT_FINITE', regionId: REGION_ID });
  });

  it('문서 Schema를 통과하지 못하는 Session과 Source 조합을 거부한다', () => {
    const error = expectMappingError(
      () => createProjectDocumentFromSession({ session: createSessionSnapshot(), audioSources: [] }),
      ProjectDocumentMappingErrorCode.INVALID_SESSION_PROJECT_STATE
    );

    expect(error.details).toMatchObject({ reason: 'PROJECT_DOCUMENT_SCHEMA_VIOLATION' });
    expect(error.cause).toBeInstanceOf(ZodError);
    expect((error.cause as ZodError).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['tracks', 0, 'regions', 0, 'sourceId'] })])
    );
  });

  it('ProjectDocument를 Session용 스냅샷과 Source metadata로 변환한다', () => {
    const restored = createProjectRestoreSnapshotFromDocument(createProjectDocument());

    expect(restored.audioSources).toEqual(createAudioSources());
    expect(restored.session).toEqual({
      project: { id: PROJECT_ID, name: '테스트 프로젝트', revision: 3 },
      tempo: 128,
      masterVolume: 0.75,
      exportStartTime: 1,
      exportEndTime: 9,
      tracks: new Map([
        [
          TRACK_ID,
          {
            id: TRACK_ID,
            name: '보컬',
            volume: 0.8,
            pan: -0.25,
            isMuted: true,
            isSoloed: false,
            status: [],
            regions: [
              {
                id: REGION_ID,
                sourceId: SOURCE_ID,
                startTime: 2,
                endTime: 5.5,
                sourceStartTime: 0.5,
                duration: 3.5,
                status: [],
              },
              {
                id: SECOND_REGION_ID,
                sourceId: SOURCE_ID,
                startTime: 6,
                endTime: 7,
                sourceStartTime: 4,
                duration: 1,
                status: [],
              },
            ],
          },
        ],
        [
          SECOND_TRACK_ID,
          {
            id: SECOND_TRACK_ID,
            name: '반주',
            volume: 1,
            pan: 0.5,
            isMuted: false,
            isSoloed: true,
            status: [],
            regions: [],
          },
        ],
      ]),
    });
  });

  it('길이 0 Region과 시작·끝이 같은 Export 범위를 왕복한다', () => {
    const session = createSessionSnapshot();
    const track = session.tracks.get(TRACK_ID);
    if (!track) {
      throw new Error('테스트 Track을 찾을 수 없습니다.');
    }
    const zeroLengthRegion = {
      ...track.regions[0],
      startTime: 4,
      endTime: 4,
      sourceStartTime: 10,
      duration: 0,
    };
    const zeroLengthSession = {
      ...session,
      exportStartTime: 2,
      exportEndTime: 2,
      tracks: new Map([[TRACK_ID, { ...track, regions: [zeroLengthRegion] }]]),
    };

    const document = createProjectDocumentFromSession({
      session: zeroLengthSession,
      audioSources: createAudioSources(),
    });
    const restored = createProjectRestoreSnapshotFromDocument(document);

    expect(document.exportRange).toEqual({ startTimeSeconds: 2, endTimeSeconds: 2 });
    expect(restored.session.tracks.get(TRACK_ID)?.regions[0]).toMatchObject({
      startTime: 4,
      endTime: 4,
      sourceStartTime: 10,
      duration: 0,
    });
  });

  it('ProjectDocument를 복원한 뒤 다시 만들면 저장 대상 값이 같다', () => {
    const document = createProjectDocument();
    const restored = createProjectRestoreSnapshotFromDocument(document);

    const remappedDocument = createProjectDocumentFromSession({
      session: restored.session,
      audioSources: restored.audioSources,
    });

    expect(remappedDocument).toEqual(document);
  });

  it('유효하지 않은 문서 입력은 원인을 보존한 Mapper 오류로 거부한다', () => {
    const invalidDocument = { ...createProjectDocument(), schemaVersion: 2 } as unknown as ProjectDocument;

    const error = expectMappingError(
      () => createProjectRestoreSnapshotFromDocument(invalidDocument),
      ProjectDocumentMappingErrorCode.INVALID_PROJECT_DOCUMENT
    );
    expect(error.details).toMatchObject({ reason: 'PROJECT_DOCUMENT_READ_FAILED' });
    expect(error.cause).toBeInstanceOf(ProjectDocumentReadError);
    expect(error.cause).toMatchObject({
      code: ProjectDocumentReadErrorCode.UNSUPPORTED_SCHEMA_VERSION,
      details: { schemaVersion: 2 },
    });
  });

  it('복원 시 계산한 Region endTime이 유한수가 아니면 거부한다', () => {
    const document = createProjectDocument();
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
    } as ProjectDocument;

    const error = expectMappingError(
      () => createProjectRestoreSnapshotFromDocument(overflowDocument),
      ProjectDocumentMappingErrorCode.INVALID_PROJECT_DOCUMENT
    );
    expect(error.details).toMatchObject({ reason: 'REGION_END_TIME_NOT_FINITE', regionId: REGION_ID });
  });

  it('양방향 변환 결과는 입력 객체와 참조를 공유하지 않는다', () => {
    const session = createSessionSnapshot();
    const audioSources = createAudioSources();
    const document = createProjectDocumentFromSession({ session, audioSources });
    const restored = createProjectRestoreSnapshotFromDocument(document);

    document.project.name = '문서 변경';
    document.audioSources[0].fileName = '문서 변경.wav';
    const restoredTrack = restored.session.tracks.get(TRACK_ID);
    if (!restoredTrack) {
      throw new Error('복원한 Track을 찾을 수 없습니다.');
    }
    restoredTrack.name = '복원값 변경';
    restored.audioSources[0].fileName = '복원값 변경.wav';

    expect(session.project.name).toBe('테스트 프로젝트');
    expect(session.tracks.get(TRACK_ID)?.name).toBe('보컬');
    expect(audioSources[0].fileName).toBe('voice.wav');
    expect(document.tracks[0].name).toBe('보컬');
    expect(document.audioSources[0].fileName).toBe('문서 변경.wav');
  });
});
