import { calculateTimeComparisonTolerance } from './time-tolerance';

interface RegionSourceSpan {
  sourceStartTimeSeconds: number;
  regionDurationSeconds: number;
}

interface RegionSourceRange extends RegionSourceSpan {
  sourceDurationSeconds: number;
}

export function calculateFiniteRegionSourceEndTime({
  sourceStartTimeSeconds,
  regionDurationSeconds,
}: RegionSourceSpan): number | null {
  if (
    !Number.isFinite(sourceStartTimeSeconds) ||
    !Number.isFinite(regionDurationSeconds) ||
    sourceStartTimeSeconds < 0 ||
    regionDurationSeconds < 0
  ) {
    return null;
  }

  const sourceEndTimeSeconds = sourceStartTimeSeconds + regionDurationSeconds;
  return Number.isFinite(sourceEndTimeSeconds) ? sourceEndTimeSeconds : null;
}

export function isRegionSourceRangeWithinDuration({
  sourceDurationSeconds,
  sourceStartTimeSeconds,
  regionDurationSeconds,
}: RegionSourceRange): boolean {
  if (!Number.isFinite(sourceDurationSeconds) || sourceDurationSeconds < 0) {
    return false;
  }

  const sourceEndTimeSeconds = calculateFiniteRegionSourceEndTime({
    sourceStartTimeSeconds,
    regionDurationSeconds,
  });
  if (sourceEndTimeSeconds === null) {
    return false;
  }

  const allowedDifference = calculateTimeComparisonTolerance({
    firstTime: sourceEndTimeSeconds,
    secondTime: sourceDurationSeconds,
  });
  return sourceEndTimeSeconds - sourceDurationSeconds <= allowedDifference;
}
