import { describe, expect, it } from 'vitest';
import {
  PROJECT_DOCUMENT_SCHEMA_VERSION_V3,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V4,
  type ProjectDocumentV3,
} from './project-document.schema';
import { readProjectDocumentSnapshot, readProjectDocumentV4 } from './project-document-reader';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TRACK_ID = '22222222-2222-4222-8222-222222222222';
const SLOT_ID = '33333333-3333-4333-8333-333333333333';
const SOURCE_ID = '44444444-4444-4444-8444-444444444444';
const MISSING_SOURCE_ID = '55555555-5555-4555-8555-555555555555';

function createV3Document(): ProjectDocumentV3 {
  return {
    audioSources: [
      {
        byteLength: 4,
        durationSeconds: 2,
        fileName: 'base.wav',
        id: SOURCE_ID,
        mimeType: 'audio/wav',
      },
    ],
    documentType: 'drop-ai-project',
    exportRange: null,
    mixer: { masterVolume: 1 },
    project: { id: PROJECT_ID, name: '라이브 프로젝트', revision: 0 },
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V3,
    timeline: { tempoBpm: 120, timeUnit: 'seconds' },
    tracks: [
      {
        id: TRACK_ID,
        isMuted: false,
        isSoloed: false,
        loopSlots: [
          {
            gain: 1,
            id: SLOT_ID,
            lengthBars: 1,
            quantizationBars: 1,
            recordedTempoBpm: 120,
            sourceId: SOURCE_ID,
          },
        ],
        name: '루프 트랙',
        pan: 0,
        pluginInstances: [],
        regions: [],
        volume: 1,
      },
    ],
  };
}

describe('ProjectDocument v4', () => {
  it('v3 단일 Source 루프를 오버더빙 배열이 빈 v4 슬롯으로 마이그레이션한다', () => {
    const document = readProjectDocumentV4(createV3Document());

    expect(document.schemaVersion).toBe(PROJECT_DOCUMENT_SCHEMA_VERSION_V4);
    expect(document.tracks[0]?.loopSlots[0]).toMatchObject({
      overdubSourceIds: [],
      sourceId: SOURCE_ID,
    });
    expect(readProjectDocumentSnapshot(document)).toEqual(document);
  });

  it('원본 Source를 오버더빙 Source로 중복 참조한 슬롯을 거부한다', () => {
    const document = readProjectDocumentV4(createV3Document());
    const invalidDocument = {
      ...document,
      tracks: document.tracks.map(track => ({
        ...track,
        loopSlots: track.loopSlots.map(slot => ({ ...slot, overdubSourceIds: [SOURCE_ID] })),
      })),
    };

    expect(() => readProjectDocumentV4(invalidDocument)).toThrowError();
  });

  it('등록되지 않은 오버더빙 Source를 참조한 슬롯을 거부한다', () => {
    const document = readProjectDocumentV4(createV3Document());
    const invalidDocument = {
      ...document,
      tracks: document.tracks.map(track => ({
        ...track,
        loopSlots: track.loopSlots.map(slot => ({ ...slot, overdubSourceIds: [MISSING_SOURCE_ID] })),
      })),
    };

    expect(() => readProjectDocumentV4(invalidDocument)).toThrowError();
  });
});
