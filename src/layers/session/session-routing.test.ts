import { describe, expect, it } from 'vitest';
import { createSessionStore, type TrackState } from './session';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TRACK_ID = '22222222-2222-4222-8222-222222222222';
const BUS_ID = '33333333-3333-4333-8333-333333333333';
const SEND_ID = '44444444-4444-4444-8444-444444444444';

function createTrack(id: string): TrackState {
  return {
    id,
    isMuted: false,
    isSoloed: false,
    name: id,
    pan: 0,
    pluginInstances: [],
    regions: [],
    status: [],
    volume: 1,
  };
}

describe('Session routing state', () => {
  it('Track 추가 시 기본 Master Route를 함께 추가한다', () => {
    const store = createSessionStore({ initialProjectMetadata: { id: PROJECT_ID, name: 'Routing', revision: 0 } });

    store.getState().addTrack(createTrack(TRACK_ID));

    expect(store.getState().routingGraph.routes).toEqual([
      {
        channelCount: 2,
        folderId: null,
        kind: 'audio',
        output: { kind: 'master' },
        trackId: TRACK_ID,
        vcaIds: [],
      },
    ]);
  });

  it('Track 제거 시 참조 Route와 Send를 함께 정리한다', () => {
    const store = createSessionStore({ initialProjectMetadata: { id: PROJECT_ID, name: 'Routing', revision: 0 } });
    store.getState().addTrack(createTrack(TRACK_ID));
    store.getState().addTrack(createTrack(BUS_ID));
    store.getState().setRoutingGraph({
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
          tapPoint: 'postFader',
        },
      ],
    });

    store.getState().removeTrack(BUS_ID);

    expect(store.getState().routingGraph).toEqual({
      routes: [expect.objectContaining({ output: { kind: 'master' }, trackId: TRACK_ID })],
      sends: [],
    });
  });
});
