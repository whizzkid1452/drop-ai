const REGION_END_TIME_TOLERANCE_SECONDS = 1e-9;
const REGION_END_TIME_ULP_FACTOR = 4;

interface RegionTimelineRange {
  startTime: number;
  duration: number;
}

interface RegionTimelineState extends RegionTimelineRange {
  endTime: number;
}

export function calculateFiniteRegionEndTime({ startTime, duration }: RegionTimelineRange): number | null {
  if (!Number.isFinite(startTime) || !Number.isFinite(duration) || startTime < 0 || duration < 0) {
    return null;
  }

  const endTime = startTime + duration;
  return Number.isFinite(endTime) ? endTime : null;
}

export function isRegionEndTimeConsistent({ startTime, duration, endTime }: RegionTimelineState): boolean {
  const calculatedEndTime = calculateFiniteRegionEndTime({ startTime, duration });
  if (calculatedEndTime === null || !Number.isFinite(endTime) || endTime < 0) {
    return false;
  }

  const magnitudeAdjustedTolerance =
    Number.EPSILON * Math.max(Math.abs(endTime), Math.abs(calculatedEndTime)) * REGION_END_TIME_ULP_FACTOR;
  const allowedDifference = Math.max(REGION_END_TIME_TOLERANCE_SECONDS, magnitudeAdjustedTolerance);

  return Math.abs(endTime - calculatedEndTime) <= allowedDifference;
}
