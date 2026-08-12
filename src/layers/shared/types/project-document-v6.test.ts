import { describe, expect, it } from 'vitest';
import { readProjectDocumentSnapshot, readProjectDocumentV5, readProjectDocumentV6 } from './project-document-reader';
import { PROJECT_DOCUMENT_SCHEMA_VERSION_V4, type ProjectDocumentV4 } from './project-document.schema';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const MARKER_ID = '22222222-2222-4222-8222-222222222222';

function createV4Document(): ProjectDocumentV4 {
  return {
    audioSources: [],
    documentType: 'drop-ai-project',
    exportRange: null,
    mixer: { masterVolume: 1 },
    project: { id: PROJECT_ID, name: 'Marker 프로젝트', revision: 0 },
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V4,
    timeline: { tempoBpm: 120, timeUnit: 'seconds' },
    tracks: [],
  };
}

describe('ProjectDocument v6', () => {
  it('v5 문서에 빈 Timeline marker 배열을 추가한다', () => {
    const document = readProjectDocumentV6(readProjectDocumentV5(createV4Document()));

    expect(document.schemaVersion).toBe(6);
    expect(document.timeline.markers).toEqual([]);
    expect(readProjectDocumentSnapshot(document)).toEqual(document);
  });

  it('Timeline marker ID 중복을 거부한다', () => {
    const document = readProjectDocumentV6(readProjectDocumentV5(createV4Document()));
    const invalidDocument = {
      ...document,
      timeline: {
        ...document.timeline,
        markers: [
          { id: MARKER_ID, name: 'Verse', quarterNotePosition: 4 },
          { id: MARKER_ID, name: 'Chorus', quarterNotePosition: 8 },
        ],
      },
    };

    expect(() => readProjectDocumentV6(invalidDocument)).toThrowError();
  });
});
