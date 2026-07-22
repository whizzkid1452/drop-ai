const ABSOLUTE_TIME_TOLERANCE_SECONDS = 1e-9;
const TIME_TOLERANCE_ULP_FACTOR = 4;

interface TimeComparisonValues {
  firstTime: number;
  secondTime: number;
}

export function calculateTimeComparisonTolerance({ firstTime, secondTime }: TimeComparisonValues): number {
  const magnitudeAdjustedTolerance =
    Number.EPSILON * Math.max(Math.abs(firstTime), Math.abs(secondTime)) * TIME_TOLERANCE_ULP_FACTOR;

  return Math.max(ABSOLUTE_TIME_TOLERANCE_SECONDS, magnitudeAdjustedTolerance);
}
