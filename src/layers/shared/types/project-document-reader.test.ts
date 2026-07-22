import { describe, expect, it } from 'vitest';
import type { ProjectDocument } from './project-document.schema';
import {
  ProjectDocumentReadErrorCode,
  readProjectDocument,
  readProjectDocumentJson,
  type ProjectDocumentReadErrorCode as ReadErrorCode,
} from './project-document-reader';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const SOURCE_ID = '44444444-4444-4444-8444-444444444444';
const TRACK_ID = '55555555-5555-4555-8555-555555555555';
const REGION_ID = '66666666-6666-4666-8666-666666666666';

function createProjectDocument(): ProjectDocument {
  return {
    documentType: 'drop-ai-project',
    schemaVersion: 1,
    project: { id: PROJECT_ID, name: '새 프로젝트', revision: 0 },
    timeline: { timeUnit: 'seconds', tempoBpm: 120 },
    mixer: { masterVolume: 1 },
    exportRange: null,
    audioSources: [],
    tracks: [],
  };
}

function createProjectDocumentWithRegion(): ProjectDocument {
  return {
    ...createProjectDocument(),
    audioSources: [
      {
        id: SOURCE_ID,
        fileName: 'source.wav',
        mimeType: 'audio/wav',
        byteLength: 1024,
        durationSeconds: 10,
      },
    ],
    tracks: [
      {
        id: TRACK_ID,
        name: '오디오 트랙',
        volume: 1,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        regions: [
          {
            id: REGION_ID,
            sourceId: SOURCE_ID,
            startTimeSeconds: 0,
            sourceStartTimeSeconds: 1,
            durationSeconds: 5,
          },
        ],
      },
    ],
  };
}

function expectReadError(read: () => unknown, code: ReadErrorCode): void {
  expect(read).toThrowError(
    expect.objectContaining({
      name: 'ProjectDocumentReadError',
      code,
    })
  );
}

describe('ProjectDocument reader', () => {
  it('검증된 v1 문서를 원본과 참조를 공유하지 않는 값으로 반환한다', () => {
    const input = createProjectDocument();

    const document = readProjectDocument(input);
    document.project.name = '읽은 문서 변경';

    expect(input.project.name).toBe('새 프로젝트');
    expect(readProjectDocument(input)).toEqual(input);
  });

  it('Source, Track, Region 배열도 원본과 참조를 공유하지 않는다', () => {
    const input = createProjectDocumentWithRegion();

    const document = readProjectDocument(input);
    document.audioSources[0].fileName = 'changed.wav';
    document.tracks[0].regions[0].durationSeconds = 1;

    expect(input.audioSources[0].fileName).toBe('source.wav');
    expect(input.tracks[0].regions[0].durationSeconds).toBe(5);
  });

  it('JSON 문자열을 파싱한 뒤 같은 v1 검증을 적용한다', () => {
    const input = createProjectDocument();

    expect(readProjectDocumentJson(JSON.stringify(input))).toEqual(input);
  });

  it('JSON 문법 오류를 문서 구조 오류와 구분한다', () => {
    expectReadError(() => readProjectDocumentJson('{'), ProjectDocumentReadErrorCode.INVALID_JSON);
  });

  it('객체가 아니거나 문서 식별자가 없는 입력을 header 오류로 분류한다', () => {
    [
      null,
      [],
      'project',
      {},
      { schemaVersion: 1 },
      { documentType: undefined, schemaVersion: 1 },
      { documentType: 1, schemaVersion: 1 },
    ].forEach(input => {
      expectReadError(() => readProjectDocument(input), ProjectDocumentReadErrorCode.INVALID_DOCUMENT_HEADER);
    });
  });

  it('상속된 문서 식별자와 버전을 문서 자체의 필드로 인정하지 않는다', () => {
    const inheritedDocument = Object.create(createProjectDocument()) as unknown;
    const inheritedSchemaVersion = Object.assign(Object.create({ schemaVersion: 1 }) as object, {
      documentType: 'drop-ai-project',
    });
    const hiddenDocumentType = Object.defineProperty({ schemaVersion: 1 }, 'documentType', {
      value: 'drop-ai-project',
    });
    const hiddenSchemaVersion = Object.defineProperty({ documentType: 'drop-ai-project' }, 'schemaVersion', {
      value: 1,
    });

    expectReadError(() => readProjectDocument(inheritedDocument), ProjectDocumentReadErrorCode.INVALID_DOCUMENT_HEADER);
    expectReadError(
      () => readProjectDocument(inheritedSchemaVersion),
      ProjectDocumentReadErrorCode.INVALID_SCHEMA_VERSION
    );
    expectReadError(
      () => readProjectDocument(hiddenDocumentType),
      ProjectDocumentReadErrorCode.INVALID_DOCUMENT_HEADER
    );
    expectReadError(
      () => readProjectDocument(hiddenSchemaVersion),
      ProjectDocumentReadErrorCode.INVALID_SCHEMA_VERSION
    );
  });

  it('상속된 본문 필드를 문서 자체의 필드로 인정하지 않는다', () => {
    const document = createProjectDocument();
    const { tracks, ...documentWithoutTracks } = document;
    const inheritedTracks = Object.assign(Object.create({ tracks }) as object, documentWithoutTracks);
    const inheritedProject = {
      ...document,
      project: Object.create(document.project) as ProjectDocument['project'],
    };

    expectReadError(() => readProjectDocument(inheritedTracks), ProjectDocumentReadErrorCode.INVALID_DOCUMENT);
    expectReadError(() => readProjectDocument(inheritedProject), ProjectDocumentReadErrorCode.INVALID_DOCUMENT);
  });

  it('희소 배열의 빈 항목을 Array prototype에서 상속하지 않는다', () => {
    const document = createProjectDocument();
    document.tracks = [
      {
        id: '22222222-2222-4222-8222-222222222222',
        name: '첫 번째 트랙',
        volume: 1,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        regions: [],
      },
    ];
    document.tracks.length = 2;
    const inheritedTrack = {
      id: '33333333-3333-4333-8333-333333333333',
      name: '상속된 트랙',
      volume: 1,
      pan: 0,
      isMuted: false,
      isSoloed: false,
      regions: [],
    };
    const previousDescriptor = Object.getOwnPropertyDescriptor(Array.prototype, '1');
    let readFailure: unknown;

    try {
      Object.defineProperty(Array.prototype, '1', {
        configurable: true,
        value: inheritedTrack,
        writable: true,
      });
      try {
        readProjectDocument(document);
      } catch (cause) {
        readFailure = cause;
      }
    } finally {
      if (previousDescriptor) {
        Object.defineProperty(Array.prototype, '1', previousDescriptor);
      } else {
        Reflect.deleteProperty(Array.prototype, '1');
      }
    }

    expect(readFailure).toEqual(
      expect.objectContaining({
        name: 'ProjectDocumentReadError',
        code: ProjectDocumentReadErrorCode.INVALID_DOCUMENT,
      })
    );
  });

  it('getter나 Proxy가 던진 예외를 판독 단계에 맞는 오류로 변환한다', () => {
    const throwingDocumentType = Object.defineProperty({}, 'documentType', {
      enumerable: true,
      get: () => {
        throw new Error('documentType getter failure');
      },
    });
    const throwingSchemaVersion = Object.defineProperties(
      {},
      {
        documentType: { enumerable: true, value: 'drop-ai-project' },
        schemaVersion: {
          enumerable: true,
          get: () => {
            throw new Error('schemaVersion getter failure');
          },
        },
      }
    );
    const throwingBody = Object.defineProperty(createProjectDocument(), 'project', {
      enumerable: true,
      get: () => {
        throw new Error('project getter failure');
      },
    });
    const accessorBody = Object.defineProperty(createProjectDocument(), 'project', {
      enumerable: true,
      get: () => createProjectDocument().project,
    });
    const throwingHeaderProxy = new Proxy(
      {},
      {
        getOwnPropertyDescriptor: () => {
          throw new Error('header proxy failure');
        },
      }
    );
    const throwingBodyProxy = new Proxy(createProjectDocument(), {
      ownKeys: () => {
        throw new Error('body proxy failure');
      },
    });
    const revokedValue = Proxy.revocable({}, {});
    revokedValue.revoke();
    const throwingRevokedValueProxy = new Proxy(createProjectDocument(), {
      ownKeys: () => {
        throw revokedValue.proxy;
      },
    });

    expectReadError(
      () => readProjectDocument(throwingDocumentType),
      ProjectDocumentReadErrorCode.INVALID_DOCUMENT_HEADER
    );
    expectReadError(
      () => readProjectDocument(throwingSchemaVersion),
      ProjectDocumentReadErrorCode.INVALID_SCHEMA_VERSION
    );
    expectReadError(() => readProjectDocument(throwingBody), ProjectDocumentReadErrorCode.INVALID_DOCUMENT);
    expectReadError(() => readProjectDocument(accessorBody), ProjectDocumentReadErrorCode.INVALID_DOCUMENT);
    expectReadError(
      () => readProjectDocument(throwingHeaderProxy),
      ProjectDocumentReadErrorCode.INVALID_DOCUMENT_HEADER
    );
    expectReadError(() => readProjectDocument(throwingBodyProxy), ProjectDocumentReadErrorCode.INVALID_DOCUMENT);
    expectReadError(
      () => readProjectDocument(throwingRevokedValueProxy),
      ProjectDocumentReadErrorCode.INVALID_DOCUMENT
    );
  });

  it('다른 문서 종류를 지원하지 않는 문서 종류로 분류한다', () => {
    expectReadError(
      () => readProjectDocument({ documentType: 'other-project', schemaVersion: 1 }),
      ProjectDocumentReadErrorCode.UNSUPPORTED_DOCUMENT_TYPE
    );
  });

  it('1 이상의 안전 정수가 아닌 schemaVersion을 잘못된 버전으로 분류한다', () => {
    const invalidSchemaVersions = [undefined, '1', -1, 0, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1];

    invalidSchemaVersions.forEach(schemaVersion => {
      expectReadError(
        () => readProjectDocument({ documentType: 'drop-ai-project', schemaVersion }),
        ProjectDocumentReadErrorCode.INVALID_SCHEMA_VERSION
      );
    });
  });

  it('정의되지 않은 안전 정수 버전을 지원하지 않는 버전으로 분류한다', () => {
    const document = createProjectDocument();

    [2, Number.MAX_SAFE_INTEGER].forEach(schemaVersion => {
      expectReadError(
        () => readProjectDocument({ ...document, schemaVersion }),
        ProjectDocumentReadErrorCode.UNSUPPORTED_SCHEMA_VERSION
      );
    });
  });

  it('v1 envelope 안의 잘못된 본문을 현재 문서 오류로 분류한다', () => {
    const document = createProjectDocument();

    expectReadError(
      () => readProjectDocument({ ...document, timeline: { timeUnit: 'samples', tempoBpm: 120 } }),
      ProjectDocumentReadErrorCode.INVALID_DOCUMENT
    );
    expectReadError(
      () => readProjectDocument({ ...document, unexpected: true }),
      ProjectDocumentReadErrorCode.INVALID_DOCUMENT
    );
  });
});
