interface RegionTimeRange {
  id: string;
  startTime: number;
  endTime: number;
}

interface ResolveSplitRegionIdOptions {
  regions: readonly RegionTimeRange[];
  splitTime: number;
}

export function resolveSplitRegionId({ regions, splitTime }: ResolveSplitRegionIdOptions): string | null {
  const matchingRegions = regions.filter(region => splitTime > region.startTime && splitTime < region.endTime);
  if (matchingRegions.length !== 1) {
    return null;
  }

  return matchingRegions[0].id;
}
