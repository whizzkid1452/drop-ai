import { describe, expect, it } from 'vitest';
import { readProjectDocumentV17, readProjectDocumentV18, readProjectDocumentSnapshot } from './project-document-reader';
import { PROJECT_DOCUMENT_SCHEMA_VERSION_V18, type ProjectDocumentV16 } from './project-document.schema';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const SNAPSHOT_ID = '22222222-2222-4222-8222-222222222222';

function createV17Document() {
  const v16 = {
    audioSources: [],
    documentType: 'drop-ai-project' as const,
    exportRange: null,
    mixer: { masterVolume: 1 },
    project: { id: PROJECT_ID, name: 'Lifecycle', revision: 2 },
    schemaVersion: 7,
    timeline: {
      loop: { isEnabled: false, range: null },
      markers: [],
      meterChanges: [{ beatUnit: 4, beatsPerBar: 4, quarterNotePosition: 0 }],
      metronome: { isEnabled: false, volume: 0.8 },
      tempoBpm: 120,
      tempoChanges: [{ bpm: 120, quarterNotePosition: 0 }],
      timeUnit: 'seconds' as const,
    },
    tracks: [],
  };
  return readProjectDocumentV17(v16 as unknown as ProjectDocumentV16);
}

describe('ProjectDocument v18', () => {
  it('v17 문서를 빈 수명주기 상태로 이전한다', () => {
    const migrated = readProjectDocumentV18(createV17Document());

    expect(migrated.schemaVersion).toBe(PROJECT_DOCUMENT_SCHEMA_VERSION_V18);
    expect(migrated.lifecycle).toEqual({ snapshots: [], templates: [] });
    expect(readProjectDocumentSnapshot(migrated)).toEqual(migrated);
  });

  it('중복 Snapshot ID를 거부한다', () => {
    const document = readProjectDocumentV18(createV17Document());
    const snapshot = {
      createdAt: '2026-08-14T00:00:00.000Z',
      document: createV17Document(),
      id: SNAPSHOT_ID,
      name: 'Before mix',
    };

    expect(() =>
      readProjectDocumentV18({
        ...document,
        lifecycle: { snapshots: [snapshot, snapshot], templates: [] },
      })
    ).toThrowError();
  });

  it('Track Template에 Track이 정확히 하나가 아니면 거부한다', () => {
    const document = readProjectDocumentV18(createV17Document());

    expect(() =>
      readProjectDocumentV18({
        ...document,
        lifecycle: {
          snapshots: [],
          templates: [
            {
              createdAt: '2026-08-14T00:00:00.000Z',
              document: createV17Document(),
              id: SNAPSHOT_ID,
              kind: 'track',
              name: 'Vocal',
            },
          ],
        },
      })
    ).toThrowError();
  });
});
