import { describe, expect, it } from 'vitest';
import type { ProjectSessionState } from '../session/session';
import type { ProjectAudioSource } from '../shared/types/project-document.schema';
import {
  createProjectDocumentV4FromSession,
  createProjectRestoreSnapshotFromDocumentV4,
} from './project-document-mapper';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TRACK_ID = '22222222-2222-4222-8222-222222222222';
const SLOT_ID = '33333333-3333-4333-8333-333333333333';
const SOURCE_ID = '44444444-4444-4444-8444-444444444444';
const OVERDUB_SOURCE_ID = '55555555-5555-4555-8555-555555555555';

function createAudioSource(id: string, fileName: string): ProjectAudioSource {
  return {
    byteLength: 4,
    durationSeconds: 2,
    fileName,
    id,
    mimeType: 'audio/wav',
  };
}

function createSession(): ProjectSessionState {
  return {
    exportEndTime: null,
    exportStartTime: null,
    masterVolume: 0.8,
    project: { id: PROJECT_ID, name: '라이브 세트', revision: 1 },
    tempo: 120,
    tracks: new Map([
      [
        TRACK_ID,
        {
          id: TRACK_ID,
          isMuted: false,
          isSoloed: false,
          loopSlots: [
            {
              errorMessage: null,
              gain: 0.75,
              id: SLOT_ID,
              lengthBars: 2,
              overdubSourceIds: [OVERDUB_SOURCE_ID],
              quantizationBars: 1,
              recordedTempoBpm: 120,
              scheduledTimeSeconds: null,
              sourceId: SOURCE_ID,
              state: 'playing',
            },
          ],
          name: '보컬 루프',
          pan: 0,
          pluginInstances: [],
          regions: [],
          status: [],
          volume: 1,
        },
      ],
    ]),
  };
}

describe('ProjectDocument v4 mapper', () => {
  it('원본과 오버더빙 Source ID를 저장하고 정지 상태로 복원한다', () => {
    const audioSources = [
      createAudioSource(SOURCE_ID, 'loop.wav'),
      createAudioSource(OVERDUB_SOURCE_ID, 'loop-overdub.wav'),
    ];
    const document = createProjectDocumentV4FromSession({ audioSources, pluginCatalog: [], session: createSession() });

    expect(document.schemaVersion).toBe(4);
    expect(document.tracks[0]?.loopSlots[0]).toMatchObject({
      overdubSourceIds: [OVERDUB_SOURCE_ID],
      sourceId: SOURCE_ID,
    });

    const snapshot = createProjectRestoreSnapshotFromDocumentV4({ document, pluginCatalog: [] });

    expect(snapshot.session.tracks.get(TRACK_ID)?.loopSlots?.[0]).toMatchObject({
      overdubSourceIds: [OVERDUB_SOURCE_ID],
      sourceId: SOURCE_ID,
      state: 'stopped',
    });
  });
});
