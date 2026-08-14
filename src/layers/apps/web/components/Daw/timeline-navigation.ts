export const TRACK_HEADER_WIDTH_PX = 248;

export type TimelineZoomFocus = 'mouse' | 'playhead' | 'center' | 'left' | 'right' | 'editPoint';

export const TIMELINE_ZOOM_FOCUS_OPTIONS = [
  { label: 'Mouse', value: 'mouse' },
  { label: 'Playhead', value: 'playhead' },
  { label: 'Center', value: 'center' },
  { label: 'Left', value: 'left' },
  { label: 'Right', value: 'right' },
  { label: 'Edit point', value: 'editPoint' },
] as const satisfies readonly { label: string; value: TimelineZoomFocus }[];

interface CalculateTimelineZoomScrollLeftOptions {
  readonly anchorQuarterNotes: number;
  readonly anchorViewportPixel: number;
  readonly maxScrollLeft?: number;
  readonly nextPixelsPerQuarterNote: number;
  readonly trackHeaderWidth?: number;
}

export interface ResolveTimelineZoomAnchorRequest {
  readonly clientWidth: number;
  readonly editPointQuarterNotes: number;
  readonly focus: TimelineZoomFocus;
  readonly mouseViewportPixel: number;
  readonly pixelsPerQuarterNote: number;
  readonly playheadQuarterNotes: number;
  readonly scrollLeft: number;
  readonly trackHeaderWidth?: number;
}

export interface TimelineZoomAnchor {
  readonly anchorQuarterNotes: number;
  readonly anchorViewportPixel: number;
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

function clampVisibleTimelineViewportPixel(
  viewportPixel: number,
  clientWidth: number,
  trackHeaderWidth: number
): number {
  return Math.min(clientWidth, Math.max(trackHeaderWidth, viewportPixel));
}

function timelinePixelToQuarterNotes(timelinePixel: number, pixelsPerQuarterNote: number): number {
  return Math.max(0, timelinePixel) / pixelsPerQuarterNote;
}

function resolveTimePositionAnchor({
  clientWidth,
  pixelsPerQuarterNote,
  quarterNotes,
  scrollLeft,
  trackHeaderWidth,
}: {
  readonly clientWidth: number;
  readonly pixelsPerQuarterNote: number;
  readonly quarterNotes: number;
  readonly scrollLeft: number;
  readonly trackHeaderWidth: number;
}): TimelineZoomAnchor {
  const viewportPixel = trackHeaderWidth + quarterNotes * pixelsPerQuarterNote - scrollLeft;
  return {
    anchorQuarterNotes: Math.max(0, quarterNotes),
    anchorViewportPixel: clampVisibleTimelineViewportPixel(viewportPixel, clientWidth, trackHeaderWidth),
  };
}

export function resolveTimelineZoomAnchor({
  clientWidth,
  editPointQuarterNotes,
  focus,
  mouseViewportPixel,
  pixelsPerQuarterNote,
  playheadQuarterNotes,
  scrollLeft,
  trackHeaderWidth = TRACK_HEADER_WIDTH_PX,
}: ResolveTimelineZoomAnchorRequest): TimelineZoomAnchor {
  const visibleTimelineWidth = Math.max(0, clientWidth - trackHeaderWidth);

  if (focus === 'left') {
    return {
      anchorQuarterNotes: timelinePixelToQuarterNotes(scrollLeft, pixelsPerQuarterNote),
      anchorViewportPixel: trackHeaderWidth,
    };
  }

  if (focus === 'right') {
    return {
      anchorQuarterNotes: timelinePixelToQuarterNotes(scrollLeft + visibleTimelineWidth, pixelsPerQuarterNote),
      anchorViewportPixel: clientWidth,
    };
  }

  if (focus === 'playhead') {
    return resolveTimePositionAnchor({
      clientWidth,
      pixelsPerQuarterNote,
      quarterNotes: playheadQuarterNotes,
      scrollLeft,
      trackHeaderWidth,
    });
  }

  if (focus === 'editPoint') {
    return resolveTimePositionAnchor({
      clientWidth,
      pixelsPerQuarterNote,
      quarterNotes: editPointQuarterNotes,
      scrollLeft,
      trackHeaderWidth,
    });
  }

  const anchorViewportPixel = focus === 'center' ? (trackHeaderWidth + clientWidth) / 2 : mouseViewportPixel;
  const anchorTimelinePixel = Math.max(0, scrollLeft + anchorViewportPixel - trackHeaderWidth);
  return {
    anchorQuarterNotes: timelinePixelToQuarterNotes(anchorTimelinePixel, pixelsPerQuarterNote),
    anchorViewportPixel,
  };
}
