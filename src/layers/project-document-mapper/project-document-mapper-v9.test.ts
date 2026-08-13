import { describe, expect, it } from 'vitest';
import type { ProjectSessionState } from '../session/session';
import {
  createProjectDocumentV9FromSession,
  createProjectRestoreSnapshotFromDocumentV9,
} from './project-document-mapper';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TRACK_ID = '22222222-2222-4222-8222-222222222222';
const BUS_ID = '33333333-3333-4333-8333-333333333333';
const SEND_ID = '44444444-4444-4444-8444-444444444444';

function createTrack(id: string, name: string) {
  return {
    id,
    isMuted: false,
    isSoloed: false,
    loopSlots: [],
    name,
    pan: 0,
    pluginInstances: [],
    regions: [],
    status: [],
    volume: 1,
  };
}

function createSession(): ProjectSessionState {
  return {
    exportEndTime: null,
    exportStartTime: null,
    masterVolume: 0.8,
    project: { id: PROJECT_ID, name: 'Routing', revision: 1 },
    routingGraph: {
      routes: [
        {
          channelCount: 2,
          folderId: null,
          kind: 'audio',
          output: { kind: 'track', trackId: BUS_ID },
          trackId: TRACK_ID,
          vcaIds: [],
        },
        {
          channelCount: 2,
          folderId: null,
          kind: 'bus',
          output: { kind: 'master' },
          trackId: BUS_ID,
          vcaIds: [],
        },
      ],
      sends: [
        {
          destinationTrackId: BUS_ID,
          gain: 0.5,
          id: SEND_ID,
          isEnabled: true,
          sourceTrackId: TRACK_ID,
          tapPoint: 'preFader',
        },
      ],
    },
    tempo: 120,
    tracks: new Map([
      [TRACK_ID, createTrack(TRACK_ID, 'Audio')],
      [BUS_ID, createTrack(BUS_ID, 'Bus')],
    ]),
  };
}

describe('ProjectDocument v9 mapper', () => {
  it('Route graph를 저장하고 같은 Session 상태로 복원한다', () => {
    const session = createSession();
    const document = createProjectDocumentV9FromSession({ audioSources: [], pluginCatalog: [], session });
    const restored = createProjectRestoreSnapshotFromDocumentV9({ document, pluginCatalog: [] });

    expect(document.schemaVersion).toBe(9);
    expect(document.mixer.routing).toEqual(session.routingGraph);
    expect(restored.session.routingGraph).toEqual(session.routingGraph);
    expect(restored.session.routingGraph).not.toBe(session.routingGraph);
  });
});
