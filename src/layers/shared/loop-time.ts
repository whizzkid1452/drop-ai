export const DEFAULT_BEATS_PER_BAR = 4;
export const MAX_LOOP_OVERDUB_LAYERS = 64;
export const SUPPORTED_LOOP_LENGTH_BARS = [1, 2, 4, 8] as const;

export type LoopLengthBars = (typeof SUPPORTED_LOOP_LENGTH_BARS)[number];

interface CalculateLoopDurationSecondsOptions {
  readonly lengthBars: LoopLengthBars;
  readonly tempoBpm: number;
}

interface CalculateNextLoopBoundarySecondsOptions {
  readonly currentTimeSeconds: number;
  readonly originTimeSeconds: number;
  readonly quantizationBars: LoopLengthBars;
  readonly tempoBpm: number;
}

const BOUNDARY_TOLERANCE_SECONDS = 1e-9;

export function isLoopLengthBars(value: unknown): value is LoopLengthBars {
  return SUPPORTED_LOOP_LENGTH_BARS.some(lengthBars => lengthBars === value);
}

export function calculateLoopDurationSeconds({
  lengthBars,
  tempoBpm,
}: CalculateLoopDurationSecondsOptions): number | null {
  if (!isLoopLengthBars(lengthBars) || !Number.isFinite(tempoBpm) || tempoBpm <= 0) {
    return null;
  }

  const durationSeconds = (lengthBars * DEFAULT_BEATS_PER_BAR * 60) / tempoBpm;
  return Number.isFinite(durationSeconds) ? durationSeconds : null;
}

export function calculateNextLoopBoundarySeconds({
  currentTimeSeconds,
  originTimeSeconds,
  quantizationBars,
  tempoBpm,
}: CalculateNextLoopBoundarySecondsOptions): number | null {
  if (
    !Number.isFinite(currentTimeSeconds) ||
    !Number.isFinite(originTimeSeconds) ||
    currentTimeSeconds < 0 ||
    originTimeSeconds < 0 ||
    currentTimeSeconds < originTimeSeconds
  ) {
    return null;
  }

  const quantizationSeconds = calculateLoopDurationSeconds({ lengthBars: quantizationBars, tempoBpm });
  if (quantizationSeconds === null) {
    return null;
  }

  const elapsedSeconds = currentTimeSeconds - originTimeSeconds;
  const boundaryIndex = Math.max(0, Math.ceil((elapsedSeconds - BOUNDARY_TOLERANCE_SECONDS) / quantizationSeconds));
  const boundarySeconds = originTimeSeconds + boundaryIndex * quantizationSeconds;
  return Number.isFinite(boundarySeconds) ? boundarySeconds : null;
}
