import { describe, expect, it } from 'vitest';
import type { ProjectSessionState } from '../session/session';
import {
  createProjectDocumentV11FromSession,
  createProjectRestoreSnapshotFromDocumentV11,
} from './project-document-mapper';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TRACK_ID = '22222222-2222-4222-8222-222222222222';

function createSession(): ProjectSessionState {
  return {
    exportEndTime: null,
    exportStartTime: null,
    masterVolume: 0.8,
    project: { id: PROJECT_ID, name: 'Automation', revision: 1 },
    tempo: 120,
    tracks: new Map([
      [
        TRACK_ID,
        {
          automationLanes: [
            {
              id: '33333333-3333-4333-8333-333333333333',
              isEnabled: true,
              points: [
                {
                  id: '44444444-4444-4444-8444-444444444444',
                  interpolation: 'linear',
                  timeSeconds: 1,
                  value: 0.5,
                },
              ],
              target: { kind: 'trackVolume' },
            },
          ],
          id: TRACK_ID,
          isMuted: false,
          isSoloed: false,
          loopSlots: [],
          name: 'Audio',
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

describe('ProjectDocument v11 mapper', () => {
  it('Automation lane과 point를 저장하고 복원한다', () => {
    const session = createSession();
    const document = createProjectDocumentV11FromSession({ audioSources: [], pluginCatalog: [], session });
    const restored = createProjectRestoreSnapshotFromDocumentV11({ document, pluginCatalog: [] });

    expect(document.schemaVersion).toBe(11);
    expect(restored.session.tracks.get(TRACK_ID)?.automationLanes).toEqual(
      session.tracks.get(TRACK_ID)?.automationLanes
    );
  });
});
