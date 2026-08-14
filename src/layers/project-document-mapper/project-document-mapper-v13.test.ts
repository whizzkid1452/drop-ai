import { describe, expect, it } from 'vitest';
import type { ProjectSessionState } from '../session/session';
import {
  createProjectDocumentV13FromSession,
  createProjectRestoreSnapshotFromDocumentV13,
} from './project-document-mapper';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TRACK_ID = '22222222-2222-4222-8222-222222222222';

describe('ProjectDocument v13 mapper', () => {
  it('MIDI Track 상태를 저장하고 독립된 객체로 복원한다', () => {
    const session: ProjectSessionState = {
      exportEndTime: null,
      exportStartTime: null,
      masterVolume: 1,
      project: { id: PROJECT_ID, name: 'MIDI', revision: 1 },
      tempo: 120,
      tracks: new Map([
        [
          TRACK_ID,
          {
            automationLanes: [],
            id: TRACK_ID,
            isMuted: false,
            isSoloed: false,
            loopSlots: [],
            midi: {
              instrumentId: 'builtin.poly-synth',
              regions: [
                {
                  durationSeconds: 2,
                  id: '33333333-3333-4333-8333-333333333333',
                  name: 'Verse',
                  notes: [
                    {
                      channel: 1,
                      durationSeconds: 0.5,
                      id: '44444444-4444-4444-8444-444444444444',
                      pitch: 64,
                      startOffsetSeconds: 0.5,
                      velocity: 96,
                    },
                  ],
                  startTimeSeconds: 1,
                },
              ],
            },
            name: 'Synth',
            pan: 0,
            pluginInstances: [],
            recording: { activePlaylistId: null, playlists: [], recordMode: 'layered' },
            regions: [],
            status: [],
            volume: 1,
          },
        ],
      ]),
    };

    const document = createProjectDocumentV13FromSession({ audioSources: [], pluginCatalog: [], session });
    const restored = createProjectRestoreSnapshotFromDocumentV13({ document, pluginCatalog: [] });

    expect(document.schemaVersion).toBe(13);
    expect(restored.session.tracks.get(TRACK_ID)?.midi).toEqual(session.tracks.get(TRACK_ID)?.midi);
    expect(restored.session.tracks.get(TRACK_ID)?.midi).not.toBe(session.tracks.get(TRACK_ID)?.midi);
  });
});
