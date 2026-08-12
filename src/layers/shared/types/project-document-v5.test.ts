import { describe, expect, it } from 'vitest';
import { PROJECT_DOCUMENT_SCHEMA_VERSION_V4, type ProjectDocumentV4 } from './project-document.schema';
import { readProjectDocumentSnapshot, readProjectDocumentV5 } from './project-document-reader';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

function createV4Document(): ProjectDocumentV4 {
  return {
    audioSources: [],
    documentType: 'drop-ai-project',
    exportRange: null,
    mixer: { masterVolume: 1 },
    project: { id: PROJECT_ID, name: 'Tempo Map 프로젝트', revision: 0 },
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V4,
    timeline: { tempoBpm: 128, timeUnit: 'seconds' },
    tracks: [],
  };
}

describe('ProjectDocument v5', () => {
  it('v4 tempo를 첫 marker로 옮기고 4/4 Meter marker를 추가한다', () => {
    const document = readProjectDocumentV5(createV4Document());

    expect(document.schemaVersion).toBe(5);
    expect(document.timeline.tempoChanges).toEqual([{ quarterNotePosition: 0, bpm: 128 }]);
    expect(document.timeline.meterChanges).toEqual([{ quarterNotePosition: 0, beatsPerBar: 4, beatUnit: 4 }]);
    expect(readProjectDocumentSnapshot(document)).toEqual(document);
  });

  it('Tempo marker 위치가 증가하지 않으면 거부한다', () => {
    const document = readProjectDocumentV5(createV4Document());
    const invalidDocument = {
      ...document,
      timeline: {
        ...document.timeline,
        tempoChanges: [
          { quarterNotePosition: 0, bpm: 128 },
          { quarterNotePosition: 0, bpm: 140 },
        ],
      },
    };

    expect(() => readProjectDocumentV5(invalidDocument)).toThrowError();
  });
});
