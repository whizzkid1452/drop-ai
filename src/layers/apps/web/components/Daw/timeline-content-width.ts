export const TIMELINE_MIN_CONTENT_WIDTH_PX = 640;
export const TIMELINE_END_PADDING_PX = 160;

interface TimelineContentWidthOptions {
  durationSeconds: number;
  coordinateMapper: TimelineCoordinateMapper;
}

export function getTimelineContentWidth({ durationSeconds, coordinateMapper }: TimelineContentWidthOptions): number {
  const projectWidth = coordinateMapper.secondsToPixels(Math.max(0, durationSeconds));

  return Math.max(TIMELINE_MIN_CONTENT_WIDTH_PX, Math.ceil(projectWidth + TIMELINE_END_PADDING_PX));
}
import type { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';
