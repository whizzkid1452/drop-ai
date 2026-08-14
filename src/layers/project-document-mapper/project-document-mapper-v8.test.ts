import { describe, expect, it } from 'vitest';
import type { ProjectSessionState } from '../session/session';
import {
  createProjectDocumentV8FromSession,
  createProjectRestoreSnapshotFromDocumentV8,
} from './project-document-mapper';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const SOURCE_ID = '22222222-2222-4222-8222-222222222222';
const TRACK_ID = '33333333-3333-4333-8333-333333333333';
const REGION_ID = '44444444-4444-4444-8444-444444444444';

function createSession(): ProjectSessionState {
  return {
    exportEndTime: null,
    exportStartTime: null,
    isLoopEnabled: false,
    isMetronomeEnabled: false,
    loopRange: null,
    masterVolume: 0.8,
    meterChanges: [{ beatUnit: 4, beatsPerBar: 4, quarterNotePosition: 0 }],
    metronomeVolume: 0.6,
    project: { id: PROJECT_ID, name: 'Region processing', revision: 1 },
    tempo: 120,
    tempoChanges: [{ bpm: 120, quarterNotePosition: 0 }],
    timelineMarkers: [],
    tracks: new Map([
      [
        TRACK_ID,
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
              duration: 4,
              endTime: 4,
              fadeIn: { crossfadeId: null, curve: 'equalPower', durationSeconds: 0.25 },
              fadeOut: { crossfadeId: null, curve: 'linear', durationSeconds: 0.5 },
              gain: 1.5,
              id: REGION_ID,
              isOpaque: true,
              layer: 2,
              sourceId: SOURCE_ID,
              sourceStartTime: 0,
              startTime: 0,
              status: [],
            },
          ],
          status: [],
          volume: 1,
        },
      ],
    ]),
  };
}

describe('ProjectDocument v8 mapper', () => {
  it('Region 처리 상태를 저장하고 같은 Session 상태로 복원한다', () => {
    const session = createSession();
    const audioSources = [
      {
        byteLength: 1,
        durationSeconds: 10,
        fileName: 'source.wav',
        id: SOURCE_ID,
        mimeType: 'audio/wav',
      },
    ];
    const document = createProjectDocumentV8FromSession({ audioSources, pluginCatalog: [], session });
    const restored = createProjectRestoreSnapshotFromDocumentV8({ document, pluginCatalog: [] });

    expect(document.schemaVersion).toBe(8);
    expect(document.tracks[0]?.regions[0]).toMatchObject({
      fadeIn: { crossfadeId: null, curve: 'equalPower', durationSeconds: 0.25 },
      fadeOut: { crossfadeId: null, curve: 'linear', durationSeconds: 0.5 },
      gain: 1.5,
      isOpaque: true,
      layer: 2,
    });
    expect(restored.session.tracks.get(TRACK_ID)?.regions[0]).toEqual(session.tracks.get(TRACK_ID)?.regions[0]);
  });
});
