import { describe, expect, it } from 'vitest';
import { readProjectDocumentV10, readProjectDocumentV11 } from './project-document-reader';
import { PROJECT_DOCUMENT_SCHEMA_VERSION_V7, type ProjectDocumentV7 } from './project-document.schema';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TRACK_ID = '22222222-2222-4222-8222-222222222222';
const LANE_ID = '33333333-3333-4333-8333-333333333333';
const POINT_ID = '44444444-4444-4444-8444-444444444444';

function createV7Document(): ProjectDocumentV7 {
  return {
    audioSources: [],
    documentType: 'drop-ai-project',
    exportRange: null,
    mixer: { masterVolume: 1 },
    project: { id: PROJECT_ID, name: 'Automation', revision: 0 },
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

describe('ProjectDocument v11', () => {
  it('v10 문서에 빈 Automation lane 목록을 추가한다', () => {
    const document = readProjectDocumentV11(readProjectDocumentV10(createV7Document()));

    expect(document.schemaVersion).toBe(11);
    expect(document.tracks[0]?.automationLanes).toEqual([]);
  });

  it('Automation point 시간이 오름차순이 아니면 거부한다', () => {
    const document = readProjectDocumentV11(createV7Document());
    const track = document.tracks[0];
    if (!track) {
      throw new Error('검증할 Track이 없습니다.');
    }

    expect(() =>
      readProjectDocumentV11({
        ...document,
        tracks: [
          {
            ...track,
            automationLanes: [
              {
                id: LANE_ID,
                isEnabled: true,
                points: [
                  { id: POINT_ID, interpolation: 'linear', timeSeconds: 2, value: 0.8 },
                  {
                    id: '55555555-5555-4555-8555-555555555555',
                    interpolation: 'hold',
                    timeSeconds: 1,
                    value: 0.4,
                  },
                ],
                target: { kind: 'trackVolume' },
              },
            ],
          },
        ],
      })
    ).toThrowError();
  });

  it('같은 Track에 같은 대상 lane이 두 개면 거부한다', () => {
    const document = readProjectDocumentV11(createV7Document());
    const track = document.tracks[0];
    if (!track) {
      throw new Error('검증할 Track이 없습니다.');
    }
    const lane = {
      id: LANE_ID,
      isEnabled: true,
      points: [{ id: POINT_ID, interpolation: 'linear' as const, timeSeconds: 0, value: 1 }],
      target: { kind: 'trackVolume' as const },
    };

    expect(() =>
      readProjectDocumentV11({
        ...document,
        tracks: [
          {
            ...track,
            automationLanes: [lane, { ...lane, id: '66666666-6666-4666-8666-666666666666' }],
          },
        ],
      })
    ).toThrowError();
  });
});
