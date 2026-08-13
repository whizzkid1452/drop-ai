import { describe, expect, it } from 'vitest';
import { readProjectDocumentV8 } from './project-document-reader';
import { PROJECT_DOCUMENT_SCHEMA_VERSION_V7, type ProjectDocumentV7 } from './project-document.schema';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const SOURCE_ID = '22222222-2222-4222-8222-222222222222';
const TRACK_ID = '33333333-3333-4333-8333-333333333333';
const FIRST_REGION_ID = '44444444-4444-4444-8444-444444444444';
const SECOND_REGION_ID = '55555555-5555-4555-8555-555555555555';
const CROSSFADE_ID = '66666666-6666-4666-8666-666666666666';

function createV7Document(): ProjectDocumentV7 {
  return {
    audioSources: [
      {
        byteLength: 1,
        durationSeconds: 10,
        fileName: 'source.wav',
        id: SOURCE_ID,
        mimeType: 'audio/wav',
      },
    ],
    documentType: 'drop-ai-project',
    exportRange: null,
    mixer: { masterVolume: 1 },
    project: { id: PROJECT_ID, name: 'Region processing', revision: 0 },
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
        regions: [
          {
            durationSeconds: 4,
            id: FIRST_REGION_ID,
            sourceId: SOURCE_ID,
            sourceStartTimeSeconds: 0,
            startTimeSeconds: 0,
          },
          {
            durationSeconds: 4,
            id: SECOND_REGION_ID,
            sourceId: SOURCE_ID,
            sourceStartTimeSeconds: 4,
            startTimeSeconds: 3,
          },
        ],
        volume: 1,
      },
    ],
  };
}

describe('ProjectDocument v8', () => {
  it('v7 Region에 기존 합산 재생을 보존하는 처리 기본값을 추가한다', () => {
    const document = readProjectDocumentV8(createV7Document());

    expect(document.schemaVersion).toBe(8);
    expect(document.tracks[0]?.regions).toEqual([
      expect.objectContaining({
        fadeIn: { crossfadeId: null, curve: 'linear', durationSeconds: 0 },
        fadeOut: { crossfadeId: null, curve: 'linear', durationSeconds: 0 },
        gain: 1,
        isOpaque: false,
        layer: 0,
      }),
      expect.objectContaining({
        fadeIn: { crossfadeId: null, curve: 'linear', durationSeconds: 0 },
        fadeOut: { crossfadeId: null, curve: 'linear', durationSeconds: 0 },
        gain: 1,
        isOpaque: false,
        layer: 1,
      }),
    ]);
  });

  it('fade 길이가 Region 길이를 넘으면 거부한다', () => {
    const document = readProjectDocumentV8(createV7Document());
    const firstRegion = document.tracks[0]?.regions[0];

    expect(firstRegion).toBeDefined();
    expect(() =>
      readProjectDocumentV8({
        ...document,
        tracks: [
          {
            ...document.tracks[0],
            regions: [
              {
                ...firstRegion,
                fadeIn: { crossfadeId: null, curve: 'linear', durationSeconds: 5 },
              },
              document.tracks[0]?.regions[1],
            ],
          },
        ],
      })
    ).toThrowError();
  });

  it('crossfade ID가 겹치는 fade-out과 fade-in을 한 쌍으로 연결해야 한다', () => {
    const document = readProjectDocumentV8(createV7Document());
    const [firstRegion, secondRegion] = document.tracks[0]?.regions ?? [];

    const crossfadedDocument = readProjectDocumentV8({
      ...document,
      tracks: [
        {
          ...document.tracks[0],
          regions: [
            {
              ...firstRegion,
              fadeOut: { crossfadeId: CROSSFADE_ID, curve: 'equalPower', durationSeconds: 1 },
            },
            {
              ...secondRegion,
              fadeIn: { crossfadeId: CROSSFADE_ID, curve: 'equalPower', durationSeconds: 1 },
            },
          ],
        },
      ],
    });

    expect(crossfadedDocument.tracks[0]?.regions[0]?.fadeOut.crossfadeId).toBe(CROSSFADE_ID);
    expect(() =>
      readProjectDocumentV8({
        ...crossfadedDocument,
        tracks: [
          {
            ...crossfadedDocument.tracks[0],
            regions: [
              crossfadedDocument.tracks[0]?.regions[0],
              {
                ...crossfadedDocument.tracks[0]?.regions[1],
                fadeIn: { crossfadeId: null, curve: 'equalPower', durationSeconds: 1 },
              },
            ],
          },
        ],
      })
    ).toThrowError();
  });
});
