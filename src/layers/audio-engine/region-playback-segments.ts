import type { RegionFadeState } from '../shared/types/region-processing';
import type { RegionData } from './i-audio-engine';

interface TimelineInterval {
  readonly endTime: number;
  readonly startTime: number;
}

interface CreateAudibleRegionSegmentsRequest {
  readonly region: RegionData;
  readonly regions: readonly RegionData[];
}

export function createAudibleRegionSegments(request: CreateAudibleRegionSegmentsRequest): RegionData[] {
  const regionEndTime = request.region.startTime + request.region.duration;
  const coverIntervals = createMergedCoverIntervals(request, regionEndTime);

  if (coverIntervals.length === 0) {
    return [cloneRegionData(request.region)];
  }

  return subtractCoverIntervals(request.region, regionEndTime, coverIntervals);
}

function createMergedCoverIntervals(
  request: CreateAudibleRegionSegmentsRequest,
  regionEndTime: number
): TimelineInterval[] {
  const coverIntervals = request.regions
    .filter(candidate => isHigherOpaqueRegion(candidate, request.region))
    .map(candidate => intersectRegion(candidate, request.region.startTime, regionEndTime))
    .filter((interval): interval is TimelineInterval => interval !== null)
    .sort((left, right) => left.startTime - right.startTime);

  return coverIntervals.reduce<TimelineInterval[]>((mergedIntervals, interval) => {
    const previousInterval = mergedIntervals.at(-1);
    if (previousInterval === undefined || interval.startTime > previousInterval.endTime) {
      return [...mergedIntervals, interval];
    }

    return [
      ...mergedIntervals.slice(0, -1),
      {
        endTime: Math.max(previousInterval.endTime, interval.endTime),
        startTime: previousInterval.startTime,
      },
    ];
  }, []);
}

function isHigherOpaqueRegion(candidate: RegionData, region: RegionData): boolean {
  return candidate.id !== region.id && candidate.isOpaque && candidate.layer > region.layer;
}

function intersectRegion(region: RegionData, rangeStartTime: number, rangeEndTime: number): TimelineInterval | null {
  const startTime = Math.max(region.startTime, rangeStartTime);
  const endTime = Math.min(region.startTime + region.duration, rangeEndTime);
  if (endTime <= startTime) {
    return null;
  }

  return { endTime, startTime };
}

function subtractCoverIntervals(
  region: RegionData,
  regionEndTime: number,
  coverIntervals: readonly TimelineInterval[]
): RegionData[] {
  const audibleIntervals: TimelineInterval[] = [];
  let audibleStartTime = region.startTime;

  for (const coverInterval of coverIntervals) {
    if (coverInterval.startTime > audibleStartTime) {
      audibleIntervals.push({ endTime: coverInterval.startTime, startTime: audibleStartTime });
    }
    audibleStartTime = Math.max(audibleStartTime, coverInterval.endTime);
  }

  if (audibleStartTime < regionEndTime) {
    audibleIntervals.push({ endTime: regionEndTime, startTime: audibleStartTime });
  }

  return audibleIntervals.map(interval => createAudibleSegment(region, regionEndTime, interval));
}

function createAudibleSegment(region: RegionData, regionEndTime: number, interval: TimelineInterval): RegionData {
  const duration = interval.endTime - interval.startTime;
  const retainsRegionStart = interval.startTime === region.startTime;
  const retainsRegionEnd = interval.endTime === regionEndTime;

  return {
    ...cloneRegionData(region),
    duration,
    fadeIn: retainsRegionStart ? clampFade(region.fadeIn, duration) : clearFade(region.fadeIn),
    fadeOut: retainsRegionEnd ? clampFade(region.fadeOut, duration) : clearFade(region.fadeOut),
    sourceStartTime: region.sourceStartTime + interval.startTime - region.startTime,
    startTime: interval.startTime,
  };
}

function clampFade(fade: RegionFadeState, segmentDuration: number): RegionFadeState {
  return {
    ...fade,
    durationSeconds: Math.min(fade.durationSeconds, segmentDuration),
  };
}

function clearFade(fade: RegionFadeState): RegionFadeState {
  return {
    ...fade,
    crossfadeId: null,
    durationSeconds: 0,
  };
}

function cloneRegionData(region: RegionData): RegionData {
  return {
    ...region,
    fadeIn: { ...region.fadeIn },
    fadeOut: { ...region.fadeOut },
  };
}
