import { describe, expect, it } from 'vitest';
import type { ProjectSessionState } from '../session/session';
import {
  createProjectDocumentV14FromSession,
  createProjectRestoreSnapshotFromDocumentV14,
} from './project-document-mapper';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TRACK_ID = '22222222-2222-4222-8222-222222222222';

describe('ProjectDocument v14 mapper', () => {
  it('MIDI 녹음 모드와 제어 lane을 저장하고 독립 객체로 복원한다', () => {
    const session: ProjectSessionState = {
      exportEndTime: null,
      exportStartTime: null,
      masterVolume: 1,
      project: { id: PROJECT_ID, name: 'MIDI Control', revision: 1 },
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
              recordMode: 'overdub',
              regions: [
                {
                  controlLanes: [
                    {
                      channel: 1,
                      id: '33333333-3333-4333-8333-333333333333',
                      points: [
                        {
                          id: '44444444-4444-4444-8444-444444444444',
                          timeOffsetSeconds: 0.5,
                          value: 4096,
                        },
                      ],
                      type: 'pitchBend',
                    },
                  ],
                  durationSeconds: 2,
                  id: '55555555-5555-4555-8555-555555555555',
                  name: 'Verse',
                  notes: [],
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

    const document = createProjectDocumentV14FromSession({ audioSources: [], pluginCatalog: [], session });
    const restored = createProjectRestoreSnapshotFromDocumentV14({ document, pluginCatalog: [] });

    expect(document.schemaVersion).toBe(14);
    expect(restored.session.tracks.get(TRACK_ID)?.midi).toEqual(session.tracks.get(TRACK_ID)?.midi);
    expect(restored.session.tracks.get(TRACK_ID)?.midi?.regions[0]?.controlLanes[0]?.points[0]).not.toBe(
      session.tracks.get(TRACK_ID)?.midi?.regions[0]?.controlLanes[0]?.points[0]
    );
  });
});
