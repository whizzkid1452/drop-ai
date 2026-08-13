import { describe, expect, it } from 'vitest';
import type { ProjectSessionState } from '../session/session';
import {
  createProjectDocumentV12FromSession,
  createProjectRestoreSnapshotFromDocumentV12,
} from './project-document-mapper';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TRACK_ID = '22222222-2222-4222-8222-222222222222';

function createSession(): ProjectSessionState {
  return {
    exportEndTime: null,
    exportStartTime: null,
    masterVolume: 0.8,
    project: { id: PROJECT_ID, name: 'Automation Write', revision: 1 },
    tempo: 120,
    tracks: new Map([
      [
        TRACK_ID,
        {
          automationLanes: [
            {
              id: '33333333-3333-4333-8333-333333333333',
              isEnabled: true,
              mode: 'latch',
              points: [],
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

describe('ProjectDocument v12 mapper', () => {
  it('Automation mode를 저장하고 복원한다', () => {
    const session = createSession();

    const document = createProjectDocumentV12FromSession({ audioSources: [], pluginCatalog: [], session });
    const restored = createProjectRestoreSnapshotFromDocumentV12({ document, pluginCatalog: [] });

    expect(document.schemaVersion).toBe(12);
    expect(restored.session.tracks.get(TRACK_ID)?.automationLanes).toEqual(
      session.tracks.get(TRACK_ID)?.automationLanes
    );
  });
});
