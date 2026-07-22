// 초 단위 두 값을 더할 때 생기는 IEEE-754 반올림 오차만 허용한다.
const SOURCE_RANGE_TOLERANCE_SECONDS = 1e-9;

interface RegionSourceRange {
  sourceDurationSeconds: number;
  sourceStartTimeSeconds: number;
  regionDurationSeconds: number;
}

export function isRegionSourceRangeWithinDuration({
  sourceDurationSeconds,
  sourceStartTimeSeconds,
  regionDurationSeconds,
}: RegionSourceRange): boolean {
  const sourceEndTimeSeconds = sourceStartTimeSeconds + regionDurationSeconds;
  return sourceEndTimeSeconds - sourceDurationSeconds <= SOURCE_RANGE_TOLERANCE_SECONDS;
}
