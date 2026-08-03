export const TIMELINE_MIN_CONTENT_WIDTH_PX = 640;
export const TIMELINE_END_PADDING_PX = 160;

interface TimelineContentWidthOptions {
  durationSeconds: number;
  pixelsPerSecond: number;
}

export function getTimelineContentWidth({ durationSeconds, pixelsPerSecond }: TimelineContentWidthOptions): number {
  const projectWidth = Math.max(0, durationSeconds) * Math.max(0, pixelsPerSecond);

  return Math.max(TIMELINE_MIN_CONTENT_WIDTH_PX, Math.ceil(projectWidth + TIMELINE_END_PADDING_PX));
}
