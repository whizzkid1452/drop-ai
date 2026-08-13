import { describe, expect, it } from 'vitest';
import { assertValidRoutingGraphSnapshot, createDefaultRoutingGraphSnapshot } from './routing-state';

const AUDIO_ID = '11111111-1111-4111-8111-111111111111';
const BUS_ID = '22222222-2222-4222-8222-222222222222';

describe('Routing graph validation', () => {
  it('Master로 출력하는 기본 Audio Route를 허용한다', () => {
    expect(() =>
      assertValidRoutingGraphSnapshot(createDefaultRoutingGraphSnapshot([AUDIO_ID]), [AUDIO_ID])
    ).not.toThrow();
  });

  it('출력과 활성 Send가 만드는 간접 순환을 거부한다', () => {
    expect(() =>
      assertValidRoutingGraphSnapshot(
        {
          routes: [
            {
              channelCount: 2,
              folderId: null,
              kind: 'aux',
              output: { kind: 'track', trackId: BUS_ID },
              trackId: AUDIO_ID,
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
              destinationTrackId: AUDIO_ID,
              gain: 1,
              id: '33333333-3333-4333-8333-333333333333',
              isEnabled: true,
              sourceTrackId: BUS_ID,
              tapPoint: 'postFader',
            },
          ],
        },
        [AUDIO_ID, BUS_ID]
      )
    ).toThrow('순환');
  });
});
