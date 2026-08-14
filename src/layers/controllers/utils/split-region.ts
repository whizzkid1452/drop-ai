import type { RegionState } from '../../session/session';

interface CalculateSplitRegionsOptions {
  region: RegionState;
  splitTime: number;
  createId?: () => string;
}

export interface SplitRegionsResult {
  left: RegionState;
  right: RegionState;
}

export function calculateSplitRegions({
  region,
  splitTime,
  createId = () => crypto.randomUUID(),
}: CalculateSplitRegionsOptions): SplitRegionsResult | null {
  if (splitTime <= region.startTime || splitTime >= region.endTime) {
    return null;
  }

  const leftDuration = splitTime - region.startTime;
  const rightDuration = region.duration - leftDuration;

  return {
    left: {
      ...region,
      id: createId(),
      endTime: splitTime,
      duration: leftDuration,
      fadeIn: {
        ...region.fadeIn,
        durationSeconds: Math.min(region.fadeIn.durationSeconds, leftDuration),
      },
      fadeOut: { crossfadeId: null, curve: region.fadeOut.curve, durationSeconds: 0 },
      status: [...region.status],
    },
    right: {
      ...region,
      id: createId(),
      startTime: splitTime,
      endTime: splitTime + rightDuration,
      sourceStartTime: region.sourceStartTime + leftDuration,
      duration: rightDuration,
      fadeIn: { crossfadeId: null, curve: region.fadeIn.curve, durationSeconds: 0 },
      fadeOut: {
        ...region.fadeOut,
        durationSeconds: Math.min(region.fadeOut.durationSeconds, rightDuration),
      },
      status: [...region.status],
    },
  };
}
