import { describe, expect, it } from 'vitest';
import { readProjectDocumentV6, readProjectDocumentV7 } from './project-document-reader';
import { PROJECT_DOCUMENT_SCHEMA_VERSION_V6, type ProjectDocumentV6 } from './project-document.schema';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

function createV6Document(): ProjectDocumentV6 {
  return {
    audioSources: [],
    documentType: 'drop-ai-project',
    exportRange: null,
    mixer: { masterVolume: 1 },
    project: { id: PROJECT_ID, name: 'Transport 프로젝트', revision: 0 },
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V6,
    timeline: {
      markers: [],
      meterChanges: [{ beatUnit: 4, beatsPerBar: 4, quarterNotePosition: 0 }],
      tempoBpm: 120,
      tempoChanges: [{ bpm: 120, quarterNotePosition: 0 }],
      timeUnit: 'seconds',
    },
    tracks: [],
  };
}

describe('ProjectDocument v7', () => {
  it('v6 문서에 비활성 Loop와 Metronome 기본값을 추가한다', () => {
    const document = readProjectDocumentV7(readProjectDocumentV6(createV6Document()));

    expect(document.schemaVersion).toBe(7);
    expect(document.timeline.loop).toEqual({ isEnabled: false, range: null });
    expect(document.timeline.metronome).toEqual({ isEnabled: false, volume: 0.8 });
  });

  it('끝이 시작과 같거나 앞선 Loop 범위를 거부한다', () => {
    const document = readProjectDocumentV7(createV6Document());

    for (const endTimeSeconds of [4, 3]) {
      expect(() =>
        readProjectDocumentV7({
          ...document,
          timeline: {
            ...document.timeline,
            loop: {
              isEnabled: true,
              range: { endTimeSeconds, startTimeSeconds: 4 },
            },
          },
        })
      ).toThrowError();
    }
  });

  it('범위가 없는데 활성화된 Loop를 거부한다', () => {
    const document = readProjectDocumentV7(createV6Document());

    expect(() =>
      readProjectDocumentV7({
        ...document,
        timeline: {
          ...document.timeline,
          loop: { isEnabled: true, range: null },
        },
      })
    ).toThrowError();
  });
});
