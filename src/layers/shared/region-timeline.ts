import { calculateTimeComparisonTolerance } from './time-tolerance';

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

  const allowedDifference = calculateTimeComparisonTolerance({ firstTime: endTime, secondTime: calculatedEndTime });

  return Math.abs(endTime - calculatedEndTime) <= allowedDifference;
}
