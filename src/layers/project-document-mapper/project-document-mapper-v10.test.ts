import { describe, expect, it } from 'vitest';
import type { ProjectSessionState } from '../session/session';
import {
  createProjectDocumentV10FromSession,
  createProjectRestoreSnapshotFromDocumentV10,
} from './project-document-mapper';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TRACK_ID = '22222222-2222-4222-8222-222222222222';
const PLAYLIST_ID = '33333333-3333-4333-8333-333333333333';

function createSession(): ProjectSessionState {
  return {
    exportEndTime: null,
    exportStartTime: null,
    masterVolume: 0.8,
    project: { id: PROJECT_ID, name: 'Takes', revision: 1 },
    recording: {
      punch: { isEnabled: true, range: { endTimeSeconds: 4, startTimeSeconds: 2 } },
      recoverableSources: [],
    },
    tempo: 120,
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
          recording: {
            activePlaylistId: PLAYLIST_ID,
            playlists: [{ compSegments: [], id: PLAYLIST_ID, name: 'Playlist 1', takes: [] }],
            recordMode: 'nonLayered',
          },
          regions: [],
          status: [],
          volume: 1,
        },
      ],
    ]),
  };
}

describe('ProjectDocument v10 mapper', () => {
  it('Punch와 Playlist 상태를 저장하고 복원한다', () => {
    const session = createSession();
    const document = createProjectDocumentV10FromSession({ audioSources: [], pluginCatalog: [], session });
    const restored = createProjectRestoreSnapshotFromDocumentV10({ document, pluginCatalog: [] });

    expect(document.schemaVersion).toBe(10);
    expect(restored.session.recording).toEqual(session.recording);
    expect(restored.session.tracks.get(TRACK_ID)?.recording).toEqual(session.tracks.get(TRACK_ID)?.recording);
  });
});
