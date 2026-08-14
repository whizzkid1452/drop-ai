import { describe, expect, it } from 'vitest';
import {
  calculateTimelineZoomScrollLeft,
  resolveTimelineZoomAnchor,
  TRACK_HEADER_WIDTH_PX,
} from './timeline-navigation';

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

  it('left·right 기준은 보이는 Timeline 가장자리를 유지한다', () => {
    const left = resolveTimelineZoomAnchor({
      clientWidth: 800,
      editPointQuarterNotes: 4,
      focus: 'left',
      mouseViewportPixel: 400,
      pixelsPerQuarterNote: 50,
      playheadQuarterNotes: 8,
      scrollLeft: 250,
    });
    const right = resolveTimelineZoomAnchor({
      clientWidth: 800,
      editPointQuarterNotes: 4,
      focus: 'right',
      mouseViewportPixel: 400,
      pixelsPerQuarterNote: 50,
      playheadQuarterNotes: 8,
      scrollLeft: 250,
    });

    expect(left).toEqual({
      anchorQuarterNotes: 5,
      anchorViewportPixel: TRACK_HEADER_WIDTH_PX,
    });
    expect(right).toEqual({
      anchorQuarterNotes: (250 + 800 - TRACK_HEADER_WIDTH_PX) / 50,
      anchorViewportPixel: 800,
    });
  });

  it('edit point와 playhead 기준은 해당 시각의 quarter note를 유지한다', () => {
    expect(
      resolveTimelineZoomAnchor({
        clientWidth: 800,
        editPointQuarterNotes: 6,
        focus: 'editPoint',
        mouseViewportPixel: 400,
        pixelsPerQuarterNote: 50,
        playheadQuarterNotes: 10,
        scrollLeft: 100,
      })
    ).toEqual({
      anchorQuarterNotes: 6,
      anchorViewportPixel: TRACK_HEADER_WIDTH_PX + 6 * 50 - 100,
    });
    expect(
      resolveTimelineZoomAnchor({
        clientWidth: 800,
        editPointQuarterNotes: 6,
        focus: 'playhead',
        mouseViewportPixel: 400,
        pixelsPerQuarterNote: 50,
        playheadQuarterNotes: 10,
        scrollLeft: 100,
      })
    ).toEqual({
      anchorQuarterNotes: 10,
      anchorViewportPixel: TRACK_HEADER_WIDTH_PX + 10 * 50 - 100,
    });
  });
});
