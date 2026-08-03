import { describe, expect, it } from 'vitest';
import {
  getTimelineContentWidth,
  TIMELINE_END_PADDING_PX,
  TIMELINE_MIN_CONTENT_WIDTH_PX,
} from './timeline-content-width';

describe('getTimelineContentWidth', () => {
  it('프로젝트가 비어 있으면 최소 타임라인 폭을 반환한다', () => {
    expect(getTimelineContentWidth({ durationSeconds: 0, pixelsPerSecond: 20 })).toBe(TIMELINE_MIN_CONTENT_WIDTH_PX);
  });

  it('프로젝트 끝 지점 뒤에 조작 여백을 포함한다', () => {
    expect(getTimelineContentWidth({ durationSeconds: 49, pixelsPerSecond: 20 })).toBe(
      49 * 20 + TIMELINE_END_PADDING_PX
    );
  });

  it('소수점 픽셀은 올림해 마지막 영역이 잘리지 않게 한다', () => {
    expect(getTimelineContentWidth({ durationSeconds: 20.01, pixelsPerSecond: 25 })).toBe(661);
  });
});
