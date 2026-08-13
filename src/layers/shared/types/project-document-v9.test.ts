import { describe, expect, it } from 'vitest';
import { readProjectDocumentV8, readProjectDocumentV9 } from './project-document-reader';
import { PROJECT_DOCUMENT_SCHEMA_VERSION_V7, type ProjectDocumentV7 } from './project-document.schema';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const FIRST_TRACK_ID = '22222222-2222-4222-8222-222222222222';
const SECOND_TRACK_ID = '33333333-3333-4333-8333-333333333333';

function createV7Document(): ProjectDocumentV7 {
  return {
    audioSources: [],
    documentType: 'drop-ai-project',
    exportRange: null,
    mixer: { masterVolume: 1 },
    project: { id: PROJECT_ID, name: 'Routing', revision: 0 },
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
    tracks: [FIRST_TRACK_ID, SECOND_TRACK_ID].map((id, index) => ({
      id,
      isMuted: false,
      isSoloed: false,
      loopSlots: [],
      name: `Track ${index + 1}`,
      pan: 0,
      pluginInstances: [],
      regions: [],
      volume: 1,
    })),
  };
}

describe('ProjectDocument v9', () => {
  it('v8 Track을 stereo Audio Route와 Master 출력으로 이관한다', () => {
    const document = readProjectDocumentV9(readProjectDocumentV8(createV7Document()));

    expect(document.schemaVersion).toBe(9);
    expect(document.mixer.routing).toEqual({
      routes: [FIRST_TRACK_ID, SECOND_TRACK_ID].map(trackId => ({
        channelCount: 2,
        folderId: null,
        kind: 'audio',
        output: { kind: 'master' },
        trackId,
        vcaIds: [],
      })),
      sends: [],
    });
  });

  it('각 Track에 Route가 없으면 거부한다', () => {
    const document = readProjectDocumentV9(createV7Document());

    expect(() =>
      readProjectDocumentV9({
        ...document,
        mixer: { ...document.mixer, routing: { routes: document.mixer.routing.routes.slice(1), sends: [] } },
      })
    ).toThrowError();
  });

  it('활성 신호 Route가 순환하면 거부한다', () => {
    const document = readProjectDocumentV9(createV7Document());

    expect(() =>
      readProjectDocumentV9({
        ...document,
        mixer: {
          ...document.mixer,
          routing: {
            routes: [
              {
                ...document.mixer.routing.routes[0],
                kind: 'bus',
                output: { kind: 'track', trackId: SECOND_TRACK_ID },
              },
              {
                ...document.mixer.routing.routes[1],
                kind: 'bus',
                output: { kind: 'track', trackId: FIRST_TRACK_ID },
              },
            ],
            sends: [],
          },
        },
      })
    ).toThrowError();
  });

  it('비활성 Send는 신호 순환으로 판정하지 않는다', () => {
    const document = readProjectDocumentV9(createV7Document());

    const routedDocument = readProjectDocumentV9({
      ...document,
      mixer: {
        ...document.mixer,
        routing: {
          routes: [
            {
              ...document.mixer.routing.routes[0],
              kind: 'bus',
              output: { kind: 'track', trackId: SECOND_TRACK_ID },
            },
            { ...document.mixer.routing.routes[1], kind: 'bus' },
          ],
          sends: [
            {
              destinationTrackId: FIRST_TRACK_ID,
              gain: 1,
              id: '44444444-4444-4444-8444-444444444444',
              isEnabled: false,
              sourceTrackId: SECOND_TRACK_ID,
              tapPoint: 'postFader',
            },
          ],
        },
      },
    });

    expect(routedDocument.mixer.routing.sends[0]?.isEnabled).toBe(false);
  });
});
