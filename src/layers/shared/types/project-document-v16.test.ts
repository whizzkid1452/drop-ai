import { describe, expect, it } from 'vitest';
import { readProjectDocumentV15, readProjectDocumentV16, readProjectDocumentSnapshot } from './project-document-reader';
import { PROJECT_DOCUMENT_SCHEMA_VERSION_V16, type ProjectDocumentV15 } from './project-document.schema';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const SOURCE_ID = '22222222-2222-4222-8222-222222222222';
const DERIVED_SOURCE_ID = '33333333-3333-4333-8333-333333333333';

function createV15Document(): ProjectDocumentV15 {
  return readProjectDocumentV15({
    audioSources: [
      {
        byteLength: 44,
        durationSeconds: 1,
        fileName: 'source.wav',
        id: SOURCE_ID,
        mimeType: 'audio/wav',
      },
    ],
    documentType: 'drop-ai-project',
    exportRange: null,
    mixer: { masterVolume: 1 },
    project: { id: PROJECT_ID, name: 'Media', revision: 0 },
    schemaVersion: 7,
    timeline: {
      loop: { isEnabled: false, range: null },
      markers: [],
      meterChanges: [{ beatUnit: 4, beatsPerBar: 4, quarterNotePosition: 0 }],
      metronome: { isEnabled: false, volume: 0.8 },
      tempoBpm: 120,
      tempoChanges: [{ bpm: 120, quarterNotePosition: 0 }],
      timeUnit: 'seconds',
    },
    tracks: [],
  });
}

describe('ProjectDocument v16', () => {
  it('v15 Source에 Media 관리 기본값을 추가한다', () => {
    const migrated = readProjectDocumentV16(createV15Document());

    expect(migrated.schemaVersion).toBe(PROJECT_DOCUMENT_SCHEMA_VERSION_V16);
    expect(migrated.audioSources[0]).toMatchObject({
      bwfMetadata: null,
      derivation: null,
      tags: [],
      transientPositionsSeconds: [],
    });
  });

  it('파생 Source 계보와 BWF metadata를 저장하고 snapshot에서 유지한다', () => {
    const document = readProjectDocumentV16(createV15Document());
    const withDerivedSource = readProjectDocumentV16({
      ...document,
      audioSources: [
        document.audioSources[0],
        {
          byteLength: 88,
          bwfMetadata: {
            codingHistory: 'A=PCM,F=48000,W=24,M=stereo',
            description: 'derived source',
            originationDate: '2026-08-13',
            originationTime: '12:34:56',
            originator: 'drop-ai',
            originatorReference: 'DROP20260813',
            timeReferenceSamples: 48_000,
          },
          derivation: {
            operation: 'timeStretch',
            parameters: { stretchRatio: 1.5 },
            sourceId: SOURCE_ID,
          },
          durationSeconds: 1.5,
          fileName: 'derived.wav',
          id: DERIVED_SOURCE_ID,
          mimeType: 'audio/wav',
          tags: ['dialogue', 'processed'],
          transientPositionsSeconds: [0.1, 0.75],
        },
      ],
    });

    expect(readProjectDocumentSnapshot(withDerivedSource)).toEqual(withDerivedSource);
  });

  it('존재하지 않는 원본을 참조하는 파생 Source를 거부한다', () => {
    const document = readProjectDocumentV16(createV15Document());
    expect(() =>
      readProjectDocumentV16({
        ...document,
        audioSources: [
          {
            ...document.audioSources[0],
            derivation: {
              operation: 'reverse',
              parameters: {},
              sourceId: DERIVED_SOURCE_ID,
            },
          },
        ],
      })
    ).toThrowError();
  });

  it('Source 길이를 벗어나거나 정렬되지 않은 transient 위치를 거부한다', () => {
    const document = readProjectDocumentV16(createV15Document());
    expect(() =>
      readProjectDocumentV16({
        ...document,
        audioSources: [{ ...document.audioSources[0], transientPositionsSeconds: [0.5, 0.25] }],
      })
    ).toThrowError();
  });
});
