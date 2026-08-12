import { describe, expect, it } from 'vitest';
import { calculateTimelineZoomScrollLeft } from './timeline-navigation';

describe('Timeline zoom anchor', () => {
  it('확대 전 anchor의 quarter note를 같은 viewport 위치에 유지한다', () => {
    expect(
      calculateTimelineZoomScrollLeft({
        anchorQuarterNotes: 10,
        anchorViewportPixel: 500,
        nextPixelsPerQuarterNote: 100,
      })
    ).toBe(748);
  });

  it('계산 결과를 scroll 범위 안으로 제한한다', () => {
    expect(
      calculateTimelineZoomScrollLeft({
        anchorQuarterNotes: 1,
        anchorViewportPixel: 600,
        maxScrollLeft: 200,
        nextPixelsPerQuarterNote: 50,
      })
    ).toBe(0);
    expect(
      calculateTimelineZoomScrollLeft({
        anchorQuarterNotes: 100,
        anchorViewportPixel: 300,
        maxScrollLeft: 200,
        nextPixelsPerQuarterNote: 50,
      })
    ).toBe(200);
  });
});
