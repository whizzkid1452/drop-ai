import { describe, expect, it } from 'vitest';
import { readProjectDocumentV18, readProjectDocumentV19, readProjectDocumentSnapshot } from './project-document-reader';
import {
  PROJECT_DOCUMENT_SCHEMA_VERSION_V19,
  type ProjectDocumentV17,
  type ProjectDocumentV18,
} from './project-document.schema';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

function createV18Document(): ProjectDocumentV18 {
  const legacy = {
    audioSources: [],
    documentType: 'drop-ai-project' as const,
    exportRange: null,
    mixer: { masterVolume: 1 },
    project: { id: PROJECT_ID, name: 'Cue', revision: 2 },
    schemaVersion: 7,
    timeline: {
      loop: { isEnabled: false, range: null },
      markers: [],
      meterChanges: [{ beatUnit: 4, beatsPerBar: 4, quarterNotePosition: 0 }],
      metronome: { isEnabled: false, volume: 0.8 },
      tempoBpm: 120,
      tempoChanges: [{ bpm: 120, quarterNotePosition: 0 }],
      timeUnit: 'seconds' as const,
    },
    tracks: [],
  };
  return readProjectDocumentV18(legacy as unknown as ProjectDocumentV17);
}

describe('ProjectDocument v19', () => {
  it('v18 문서를 기본 Cue 상태로 이전한다', () => {
    const migrated = readProjectDocumentV19(createV18Document());

    expect(migrated.schemaVersion).toBe(PROJECT_DOCUMENT_SCHEMA_VERSION_V19);
    expect(migrated.cue).toEqual({ performances: [] });
    expect(readProjectDocumentSnapshot(migrated)).toEqual(migrated);
  });

  it('끝이 시작보다 이르거나 같은 Clip 범위를 거부한다', () => {
    const document = readProjectDocumentV19(createV18Document());
    const trackId = '22222222-2222-4222-8222-222222222222';
    const slotId = '33333333-3333-4333-8333-333333333333';

    expect(() =>
      readProjectDocumentV19({
        ...document,
        tracks: [
          {
            automationLanes: [],
            id: trackId,
            isMuted: false,
            isSoloed: false,
            loopSlots: [
              {
                followAction: { afterBars: 1, type: 'none' },
                gain: 1,
                id: slotId,
                launchMode: 'trigger',
                lengthBars: 1,
                name: 'Clip 1',
                overdubSourceIds: [],
                quantizationBars: 1,
                recordedTempoBpm: null,
                sourceEndTimeSeconds: 1,
                sourceId: null,
                sourceStartTimeSeconds: 1,
              },
            ],
            midi: null,
            name: 'Audio 1',
            pan: 0,
            pluginInstances: [],
            recording: {
              activePlaylistId: '44444444-4444-4444-8444-444444444444',
              inputRoute: { channelCount: 1, deviceId: null },
              isArmed: false,
              playlists: [
                {
                  compSegments: [],
                  id: '44444444-4444-4444-8444-444444444444',
                  name: 'Main',
                  takes: [],
                },
              ],
              recordMode: 'replace',
            },
            regions: [],
            volume: 1,
          },
        ],
      })
    ).toThrowError();
  });
});
