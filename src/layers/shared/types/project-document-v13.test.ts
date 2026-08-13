import { describe, expect, it } from 'vitest';
import { readProjectDocumentV12, readProjectDocumentV13, readProjectDocumentSnapshot } from './project-document-reader';
import {
  PROJECT_DOCUMENT_SCHEMA_VERSION_V7,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V13,
  type ProjectDocumentV7,
} from './project-document.schema';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TRACK_ID = '22222222-2222-4222-8222-222222222222';
const MIDI_REGION_ID = '33333333-3333-4333-8333-333333333333';
const MIDI_NOTE_ID = '44444444-4444-4444-8444-444444444444';

function createV7Document(): ProjectDocumentV7 {
  return {
    audioSources: [],
    documentType: 'drop-ai-project',
    exportRange: null,
    mixer: { masterVolume: 1 },
    project: { id: PROJECT_ID, name: 'MIDI', revision: 0 },
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
        name: 'Track',
        pan: 0,
        pluginInstances: [],
        regions: [],
        volume: 1,
      },
    ],
  };
}

describe('ProjectDocument v13', () => {
  it('v12 Track을 Audio Track으로 migration하고 입력 문서를 변경하지 않는다', () => {
    const v12Document = readProjectDocumentV12(createV7Document());

    const document = readProjectDocumentV13(v12Document);

    expect(document.schemaVersion).toBe(PROJECT_DOCUMENT_SCHEMA_VERSION_V13);
    expect(document.tracks[0]?.midi).toBeNull();
    expect(v12Document.tracks[0]).not.toHaveProperty('midi');
  });

  it('MIDI Region과 상대 시간 Note를 검증한다', () => {
    const migrated = readProjectDocumentV13(readProjectDocumentV12(createV7Document()));
    const track = migrated.tracks[0];
    if (!track) {
      throw new Error('검증할 Track이 없습니다.');
    }

    const document = readProjectDocumentV13({
      ...migrated,
      tracks: [
        {
          ...track,
          midi: {
            instrumentId: 'builtin.poly-synth',
            regions: [
              {
                durationSeconds: 2,
                id: MIDI_REGION_ID,
                name: 'Verse',
                notes: [
                  {
                    channel: 1,
                    durationSeconds: 0.5,
                    id: MIDI_NOTE_ID,
                    pitch: 60,
                    startOffsetSeconds: 1.5,
                    velocity: 100,
                  },
                ],
                startTimeSeconds: 4,
              },
            ],
          },
        },
      ],
    });

    expect(document.tracks[0]?.midi?.regions[0]?.notes[0]).toMatchObject({
      pitch: 60,
      startOffsetSeconds: 1.5,
    });
  });

  it('Region 범위를 벗어나는 MIDI Note를 거부한다', () => {
    const migrated = readProjectDocumentV13(readProjectDocumentV12(createV7Document()));
    const track = migrated.tracks[0];
    if (!track) {
      throw new Error('검증할 Track이 없습니다.');
    }

    expect(() =>
      readProjectDocumentV13({
        ...migrated,
        tracks: [
          {
            ...track,
            midi: {
              instrumentId: 'builtin.poly-synth',
              regions: [
                {
                  durationSeconds: 2,
                  id: MIDI_REGION_ID,
                  name: 'Invalid',
                  notes: [
                    {
                      channel: 1,
                      durationSeconds: 1,
                      id: MIDI_NOTE_ID,
                      pitch: 60,
                      startOffsetSeconds: 1.5,
                      velocity: 100,
                    },
                  ],
                  startTimeSeconds: 0,
                },
              ],
            },
          },
        ],
      })
    ).toThrowError();
  });

  it('v13 문서를 migration 없이 Snapshot으로 복제한다', () => {
    const document = readProjectDocumentV13(readProjectDocumentV12(createV7Document()));

    const snapshot = readProjectDocumentSnapshot(document);

    expect(snapshot).toEqual(document);
    expect(snapshot).not.toBe(document);
  });
});
