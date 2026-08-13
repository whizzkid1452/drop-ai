import { describe, expect, it } from 'vitest';
import { readProjectDocumentV9, readProjectDocumentV10 } from './project-document-reader';
import { PROJECT_DOCUMENT_SCHEMA_VERSION_V7, type ProjectDocumentV7 } from './project-document.schema';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TRACK_ID = '22222222-2222-4222-8222-222222222222';

function createV7Document(): ProjectDocumentV7 {
  return {
    audioSources: [],
    documentType: 'drop-ai-project',
    exportRange: null,
    mixer: { masterVolume: 1 },
    project: { id: PROJECT_ID, name: 'Takes', revision: 0 },
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

describe('ProjectDocument v10', () => {
  it('v9 문서에 기본 Punch와 빈 Playlist 상태를 추가한다', () => {
    const document = readProjectDocumentV10(readProjectDocumentV9(createV7Document()));

    expect(document.schemaVersion).toBe(10);
    expect(document.recording).toEqual({ punch: { isEnabled: false, range: null }, recoverableSources: [] });
    expect(document.tracks[0]?.recording).toEqual({
      activePlaylistId: null,
      playlists: [],
      recordMode: 'layered',
    });
  });

  it('활성 Playlist가 Track에 없으면 거부한다', () => {
    const document = readProjectDocumentV10(createV7Document());

    expect(() =>
      readProjectDocumentV10({
        ...document,
        tracks: [
          {
            ...document.tracks[0],
            recording: {
              activePlaylistId: '33333333-3333-4333-8333-333333333333',
              playlists: [],
              recordMode: 'layered',
            },
          },
        ],
      })
    ).toThrowError();
  });

  it('Comp 구간이 참조하지 않는 Take를 가리키면 거부한다', () => {
    const document = readProjectDocumentV10(createV7Document());

    expect(() =>
      readProjectDocumentV10({
        ...document,
        tracks: [
          {
            ...document.tracks[0],
            recording: {
              activePlaylistId: '33333333-3333-4333-8333-333333333333',
              playlists: [
                {
                  compSegments: [
                    {
                      endTimeSeconds: 2,
                      id: '44444444-4444-4444-8444-444444444444',
                      startTimeSeconds: 1,
                      takeId: '55555555-5555-4555-8555-555555555555',
                    },
                  ],
                  id: '33333333-3333-4333-8333-333333333333',
                  name: 'Playlist 1',
                  takes: [],
                },
              ],
              recordMode: 'layered',
            },
          },
        ],
      })
    ).toThrowError();
  });
});
