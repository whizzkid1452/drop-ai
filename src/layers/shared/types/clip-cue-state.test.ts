import { describe, expect, it } from 'vitest';
import { cloneCueState, createDefaultCueState } from './clip-cue-state';

describe('Cue 상태', () => {
  it('기본 상태는 저장된 연주가 없다', () => {
    expect(createDefaultCueState()).toEqual({ performances: [] });
  });

  it('연주와 Event를 깊은 복사한다', () => {
    const state = {
      performances: [
        {
          createdAt: '2026-08-14T00:00:00.000Z',
          events: [
            {
              durationQuarterNotes: 4,
              id: '11111111-1111-4111-8111-111111111111',
              slotId: '22222222-2222-4222-8222-222222222222',
              startQuarterNotes: 0,
              trackId: '33333333-3333-4333-8333-333333333333',
            },
          ],
          id: '44444444-4444-4444-8444-444444444444',
          name: '첫 연주',
        },
      ],
    } as const;

    const clone = cloneCueState(state);

    expect(clone).toEqual(state);
    expect(clone).not.toBe(state);
    expect(clone.performances[0]?.events).not.toBe(state.performances[0]?.events);
  });
});
