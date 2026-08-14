import { describe, expect, it } from 'vitest';
import { readProjectDocumentV13, readProjectDocumentV14, readProjectDocumentSnapshot } from './project-document-reader';
import {
  PROJECT_DOCUMENT_SCHEMA_VERSION_V7,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V14,
  type ProjectDocumentV7,
} from './project-document.schema';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TRACK_ID = '22222222-2222-4222-8222-222222222222';
const MIDI_REGION_ID = '33333333-3333-4333-8333-333333333333';
const CONTROL_LANE_ID = '44444444-4444-4444-8444-444444444444';
const CONTROL_POINT_ID = '55555555-5555-4555-8555-555555555555';

function createV7Document(): ProjectDocumentV7 {
  return {
    audioSources: [],
    documentType: 'drop-ai-project',
    exportRange: null,
    mixer: { masterVolume: 1 },
    project: { id: PROJECT_ID, name: 'MIDI Control', revision: 0 },
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

function createV14Document() {
  const v13Document = readProjectDocumentV13(createV7Document());
  const track = v13Document.tracks[0];
  if (!track) {
    throw new Error('검증할 Track이 없습니다.');
  }

  return {
    ...readProjectDocumentV14(v13Document),
    tracks: [
      {
        ...track,
        midi: {
          instrumentId: 'builtin.poly-synth',
          recordMode: 'overdub' as const,
          regions: [
            {
              controlLanes: [
                {
                  channel: 1,
                  controllerNumber: 74,
                  id: CONTROL_LANE_ID,
                  points: [{ id: CONTROL_POINT_ID, timeOffsetSeconds: 0.5, value: 96 }],
                  type: 'controlChange' as const,
                },
              ],
              durationSeconds: 2,
              id: MIDI_REGION_ID,
              name: 'Verse',
              notes: [],
              startTimeSeconds: 0,
            },
          ],
        },
      },
    ],
  };
}

describe('ProjectDocument v14', () => {
  it('v13 MIDI 상태에 기본 녹음 모드와 빈 제어 lane을 추가한다', () => {
    const v13Document = readProjectDocumentV13(createV7Document());
    const track = v13Document.tracks[0];
    if (!track) {
      throw new Error('검증할 Track이 없습니다.');
    }
    const documentWithMidi = readProjectDocumentV13({
      ...v13Document,
      tracks: [
        {
          ...track,
          midi: {
            instrumentId: 'builtin.poly-synth',
            regions: [
              {
                durationSeconds: 1,
                id: MIDI_REGION_ID,
                name: 'Legacy MIDI',
                notes: [],
                startTimeSeconds: 0,
              },
            ],
          },
        },
      ],
    });

    const migrated = readProjectDocumentV14(documentWithMidi);

    expect(migrated.schemaVersion).toBe(PROJECT_DOCUMENT_SCHEMA_VERSION_V14);
    expect(migrated.tracks[0]?.midi?.recordMode).toBe('replace');
    expect(migrated.tracks[0]?.midi?.regions[0]?.controlLanes).toEqual([]);
    expect(documentWithMidi.tracks[0]?.midi?.regions[0]).not.toHaveProperty('controlLanes');
  });

  it.each([
    ['CC controller', { controllerNumber: 128 }],
    ['CC value', { points: [{ id: CONTROL_POINT_ID, timeOffsetSeconds: 0.5, value: 128 }] }],
  ])('범위를 벗어난 %s를 거부한다', (_label, lanePatch) => {
    const document = createV14Document();
    const midi = document.tracks[0]?.midi;
    if (!midi) {
      throw new Error('검증할 MIDI 상태가 없습니다.');
    }
    const lane = midi.regions[0]?.controlLanes[0];
    if (!lane || lane.type !== 'controlChange') {
      throw new Error('검증할 CC lane이 없습니다.');
    }

    expect(() =>
      readProjectDocumentV14({
        ...document,
        tracks: [
          {
            ...document.tracks[0],
            midi: {
              ...midi,
              regions: [
                {
                  ...midi.regions[0],
                  controlLanes: [{ ...lane, ...lanePatch }],
                },
              ],
            },
          },
        ],
      })
    ).toThrowError();
  });

  it.each([-8193, 8192])('범위를 벗어난 pitch bend 값 %s를 거부한다', value => {
    const document = createV14Document();
    const midi = document.tracks[0]?.midi;
    if (!midi) {
      throw new Error('검증할 MIDI 상태가 없습니다.');
    }

    expect(() =>
      readProjectDocumentV14({
        ...document,
        tracks: [
          {
            ...document.tracks[0],
            midi: {
              ...midi,
              regions: [
                {
                  ...midi.regions[0],
                  controlLanes: [
                    {
                      channel: 1,
                      id: CONTROL_LANE_ID,
                      points: [{ id: CONTROL_POINT_ID, timeOffsetSeconds: 0.5, value }],
                      type: 'pitchBend',
                    },
                  ],
                },
              ],
            },
          },
        ],
      })
    ).toThrowError();
  });

  it('Region 종료 시점의 channel pressure 포인트를 거부한다', () => {
    const document = createV14Document();
    const midi = document.tracks[0]?.midi;
    if (!midi) {
      throw new Error('검증할 MIDI 상태가 없습니다.');
    }

    expect(() =>
      readProjectDocumentV14({
        ...document,
        tracks: [
          {
            ...document.tracks[0],
            midi: {
              ...midi,
              regions: [
                {
                  ...midi.regions[0],
                  controlLanes: [
                    {
                      channel: 1,
                      id: CONTROL_LANE_ID,
                      points: [{ id: CONTROL_POINT_ID, timeOffsetSeconds: 2, value: 100 }],
                      type: 'channelPressure',
                    },
                  ],
                },
              ],
            },
          },
        ],
      })
    ).toThrowError();
  });

  it('중복된 MIDI 제어 포인트 ID를 거부한다', () => {
    const document = createV14Document();
    const midi = document.tracks[0]?.midi;
    if (!midi) {
      throw new Error('검증할 MIDI 상태가 없습니다.');
    }
    const lane = midi.regions[0]?.controlLanes[0];
    if (!lane) {
      throw new Error('검증할 MIDI 제어 lane이 없습니다.');
    }

    expect(() =>
      readProjectDocumentV14({
        ...document,
        tracks: [
          {
            ...document.tracks[0],
            midi: {
              ...midi,
              regions: [
                {
                  ...midi.regions[0],
                  controlLanes: [
                    lane,
                    {
                      channel: 1,
                      id: '66666666-6666-4666-8666-666666666666',
                      points: [{ ...lane.points[0], timeOffsetSeconds: 1 }],
                      type: 'channelPressure',
                    },
                  ],
                },
              ],
            },
          },
        ],
      })
    ).toThrowError();
  });

  it('v14 문서를 migration 없이 Snapshot으로 복제한다', () => {
    const document = readProjectDocumentV14(createV14Document());

    const snapshot = readProjectDocumentSnapshot(document);

    expect(snapshot).toEqual(document);
    expect(snapshot).not.toBe(document);
  });
});
