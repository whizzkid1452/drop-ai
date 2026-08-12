export const TRACK_HEADER_WIDTH_PX = 248;

export type TimelineZoomFocus = 'mouse' | 'playhead' | 'center';

interface CalculateTimelineZoomScrollLeftOptions {
  readonly anchorQuarterNotes: number;
  readonly anchorViewportPixel: number;
  readonly maxScrollLeft?: number;
  readonly nextPixelsPerQuarterNote: number;
  readonly trackHeaderWidth?: number;
}

export function calculateTimelineZoomScrollLeft({
  anchorQuarterNotes,
  anchorViewportPixel,
  maxScrollLeft = Number.POSITIVE_INFINITY,
  nextPixelsPerQuarterNote,
  trackHeaderWidth = TRACK_HEADER_WIDTH_PX,
}: CalculateTimelineZoomScrollLeftOptions): number {
  const requestedScrollLeft =
    Math.max(0, anchorQuarterNotes) * nextPixelsPerQuarterNote + trackHeaderWidth - anchorViewportPixel;
  return Math.min(Math.max(0, requestedScrollLeft), Math.max(0, maxScrollLeft));
}
