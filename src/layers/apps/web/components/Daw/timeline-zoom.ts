export const DEFAULT_TIMELINE_PIXELS_PER_QUARTER_NOTE = 48;
export const MAX_TIMELINE_PIXELS_PER_QUARTER_NOTE = 1_024;
export const MIN_TIMELINE_PIXELS_PER_QUARTER_NOTE = 4;
export const TIMELINE_ZOOM_FACTOR = 1.1;

export function clampTimelinePixelsPerQuarterNote(pixelsPerQuarterNote: number): number {
  return Math.max(
    MIN_TIMELINE_PIXELS_PER_QUARTER_NOTE,
    Math.min(MAX_TIMELINE_PIXELS_PER_QUARTER_NOTE, pixelsPerQuarterNote)
  );
}
