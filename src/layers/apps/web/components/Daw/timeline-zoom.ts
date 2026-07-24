export const DEFAULT_TIMELINE_PIXELS_PER_SECOND = 20;
export const MAX_TIMELINE_PIXELS_PER_SECOND = 1000;
export const MIN_TIMELINE_PIXELS_PER_SECOND = 1;
export const TIMELINE_ZOOM_FACTOR = 1.1;

export function clampTimelinePixelsPerSecond(pixelsPerSecond: number): number {
  return Math.max(MIN_TIMELINE_PIXELS_PER_SECOND, Math.min(MAX_TIMELINE_PIXELS_PER_SECOND, pixelsPerSecond));
}
