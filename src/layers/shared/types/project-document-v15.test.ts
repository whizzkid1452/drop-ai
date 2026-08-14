import { describe, expect, it } from 'vitest';
import { readProjectDocumentV14, readProjectDocumentV15, readProjectDocumentSnapshot } from './project-document-reader';
import {
  PROJECT_DOCUMENT_SCHEMA_VERSION_V7,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V15,
  type ProjectDocumentV7,
} from './project-document.schema';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TRACK_ID = '22222222-2222-4222-8222-222222222222';
const SECOND_TRACK_ID = '33333333-3333-4333-8333-333333333333';
const PLUGIN_INSTANCE_ID = '44444444-4444-4444-8444-444444444444';

function createV7Document(): ProjectDocumentV7 {
  const createTrack = (id: string) => ({
    id,
    isMuted: false,
    isSoloed: false,
    loopSlots: [],
    name: 'Track',
    pan: 0,
    pluginInstances: [],
    regions: [],
    volume: 1,
  });
  return {
    audioSources: [],
    documentType: 'drop-ai-project',
    exportRange: null,
    mixer: { masterVolume: 1 },
    project: { id: PROJECT_ID, name: 'Plugin state', revision: 0 },
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
    tracks: [createTrack(TRACK_ID), createTrack(SECOND_TRACK_ID)],
  };
}

describe('ProjectDocument v15', () => {
  it('v14 Plugin instance에 preset, state blob, sidechain 기본값을 추가한다', () => {
    const v14Document = readProjectDocumentV14(createV7Document());
    const track = v14Document.tracks[0];
    if (!track) {
      throw new Error('검증할 Track이 없습니다.');
    }
    const documentWithPlugin = readProjectDocumentV14({
      ...v14Document,
      tracks: [
        {
          ...track,
          pluginInstances: [
            {
              id: PLUGIN_INSTANCE_ID,
              isEnabled: true,
              manifestId: 'builtin.gain',
              manifestVersion: '1.0.0',
              parameters: [{ id: 'gain', value: 1 }],
            },
          ],
        },
        v14Document.tracks[1],
      ],
    });

    const migrated = readProjectDocumentV15(documentWithPlugin);

    expect(migrated.schemaVersion).toBe(PROJECT_DOCUMENT_SCHEMA_VERSION_V15);
    expect(migrated.tracks[0]?.pluginInstances[0]).toMatchObject({
      presetId: null,
      sidechainSourceTrackId: null,
      stateBlob: null,
    });
  });

  it('다른 Track을 sidechain source로 저장하고 snapshot에서 유지한다', () => {
    const document = readProjectDocumentV15(createV7Document());
    const firstTrack = document.tracks[0];
    if (!firstTrack) {
      throw new Error('검증할 Track이 없습니다.');
    }
    const withPlugin = readProjectDocumentV15({
      ...document,
      tracks: [
        {
          ...firstTrack,
          pluginInstances: [
            {
              id: PLUGIN_INSTANCE_ID,
              isEnabled: true,
              manifestId: 'builtin.gain',
              manifestVersion: '1.0.0',
              parameters: [{ id: 'gain', value: 1 }],
              presetId: 'unity',
              sidechainSourceTrackId: SECOND_TRACK_ID,
              stateBlob: '{"mode":"clean"}',
            },
          ],
        },
        document.tracks[1],
      ],
    });

    expect(readProjectDocumentSnapshot(withPlugin)).toEqual(withPlugin);
  });

  it('자기 Track sidechain을 거부한다', () => {
    const document = readProjectDocumentV15(createV7Document());
    const firstTrack = document.tracks[0];
    expect(() =>
      readProjectDocumentV15({
        ...document,
        tracks: [
          {
            ...firstTrack,
            pluginInstances: [
              {
                id: PLUGIN_INSTANCE_ID,
                isEnabled: true,
                manifestId: 'builtin.gain',
                manifestVersion: '1.0.0',
                parameters: [{ id: 'gain', value: 1 }],
                presetId: null,
                sidechainSourceTrackId: TRACK_ID,
                stateBlob: null,
              },
            ],
          },
          document.tracks[1],
        ],
      })
    ).toThrowError();
  });
});
