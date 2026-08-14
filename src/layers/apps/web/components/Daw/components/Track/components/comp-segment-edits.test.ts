import { describe, expect, it } from 'vitest';
import { replaceCompRange } from './comp-segment-edits';

describe('replaceCompRange', () => {
  it('기존 Comp 구간 가운데를 새 Take로 바꾸며 좌우 구간을 보존한다', () => {
    const ids = ['right-id', 'selected-id'];

    expect(
      replaceCompRange({
        createId: () => ids.shift() ?? 'unexpected-id',
        currentSegments: [{ endTimeSeconds: 8, id: 'original-id', startTimeSeconds: 2, takeId: 'take-1' }],
        range: { endTimeSeconds: 6, startTimeSeconds: 4 },
        takeId: 'take-2',
      })
    ).toEqual([
      { endTimeSeconds: 4, id: 'original-id', startTimeSeconds: 2, takeId: 'take-1' },
      { endTimeSeconds: 6, id: 'selected-id', startTimeSeconds: 4, takeId: 'take-2' },
      { endTimeSeconds: 8, id: 'right-id', startTimeSeconds: 6, takeId: 'take-1' },
    ]);
  });
});
