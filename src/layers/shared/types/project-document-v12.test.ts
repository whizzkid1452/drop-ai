import { describe, expect, it } from 'vitest';
import { readProjectDocumentV11, readProjectDocumentV12, readProjectDocumentSnapshot } from './project-document-reader';
import {
  PROJECT_DOCUMENT_SCHEMA_VERSION_V7,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V12,
  type ProjectDocumentV7,
} from './project-document.schema';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TRACK_ID = '22222222-2222-4222-8222-222222222222';
const LANE_ID = '33333333-3333-4333-8333-333333333333';

function createV7Document(): ProjectDocumentV7 {
  return {
    audioSources: [],
    documentType: 'drop-ai-project',
    exportRange: null,
    mixer: { masterVolume: 1 },
    project: { id: PROJECT_ID, name: 'Automation Write', revision: 0 },
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V7,
    timeline: {
      loop: { isEnabled: false, range: null },
      markers: [],
      meterChanges: [{ beatUnit: 4, beatsPerBar: 4, quarterNotePosition: 0 }],
      metronome: { isEnabled: false, volume: 0.8 },
      tempoBpm: 120,
      tempoChanges: [{ bpm: 120, quarterNotePosition: 0 }],
      timeUnit: 'seconds',
    },
    tracks: [
      {
        id: TRACK_ID,
        isMuted: false,
        isSoloed: false,
        loopSlots: [],
        name: 'Audio',
        pan: 0,
        pluginInstances: [],
        regions: [],
        volume: 1,
      },
    ],
  };
}

describe('ProjectDocument v12', () => {
  it('v11 Automation Lane을 Read mode로 migration한다', () => {
    const v11Document = readProjectDocumentV11(createV7Document());
    v11Document.tracks[0]?.automationLanes.push({
      id: LANE_ID,
      isEnabled: true,
      points: [],
      target: { kind: 'trackVolume' },
    });

    const document = readProjectDocumentV12(v11Document);

    expect(document.schemaVersion).toBe(PROJECT_DOCUMENT_SCHEMA_VERSION_V12);
    expect(document.tracks[0]?.automationLanes[0]?.mode).toBe('read');
    expect(v11Document.tracks[0]?.automationLanes[0]).not.toHaveProperty('mode');
  });

  it('정의되지 않은 Automation mode를 거부한다', () => {
    const document = readProjectDocumentV12(readProjectDocumentV11(createV7Document()));
    const track = document.tracks[0];
    if (!track) {
      throw new Error('검증할 Track이 없습니다.');
    }

    expect(() =>
      readProjectDocumentV12({
        ...document,
        tracks: [
          {
            ...track,
            automationLanes: [
              {
                id: LANE_ID,
                isEnabled: true,
                mode: 'unknown',
                points: [],
                target: { kind: 'trackVolume' },
              },
            ],
          },
        ],
      })
    ).toThrowError();
  });

  it('v12 문서를 migration 없이 Snapshot으로 읽는다', () => {
    const document = readProjectDocumentV12(readProjectDocumentV11(createV7Document()));

    const snapshot = readProjectDocumentSnapshot(document);

    expect(snapshot).toEqual(document);
    expect(snapshot).not.toBe(document);
  });
});
