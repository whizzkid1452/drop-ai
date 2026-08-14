import type { AutomationLaneState, AutomationPointState } from '@/layers/shared/types/automation-state';

const MINIMUM_POINT_INTERVAL_SECONDS = 0.001;

export interface AutomationPointClipboard {
  readonly points: ReadonlyArray<Omit<AutomationPointState, 'id' | 'timeSeconds'> & { readonly offsetSeconds: number }>;
}

interface AddAutomationPointRequest {
  readonly lane: AutomationLaneState;
  readonly point: AutomationPointState;
}

interface EditAutomationPointsRequest {
  readonly lane: AutomationLaneState;
  readonly pointIds: ReadonlySet<string>;
}

interface MoveAutomationPointRequest {
  readonly lane: AutomationLaneState;
  readonly pointId: string;
  readonly timeSeconds: number;
  readonly value: number;
}

interface PasteAutomationPointsRequest {
  readonly clipboard: AutomationPointClipboard;
  readonly createId: () => string;
  readonly lane: AutomationLaneState;
  readonly startTimeSeconds: number;
}

interface EraseAutomationRangeRequest {
  readonly endTimeSeconds: number;
  readonly lane: AutomationLaneState;
  readonly startTimeSeconds: number;
}

export function addAutomationPoint({ lane, point }: AddAutomationPointRequest): AutomationLaneState {
  const normalizedPoint = normalizeAutomationPoint(point);
  const pointAtSameTime = lane.points.find(candidate => candidate.timeSeconds === normalizedPoint.timeSeconds);
  if (pointAtSameTime) {
    return replaceLanePoints(
      lane,
      lane.points.map(candidate =>
        candidate.id === pointAtSameTime.id
          ? {
              ...candidate,
              interpolation: normalizedPoint.interpolation,
              value: normalizedPoint.value,
            }
          : candidate
      )
    );
  }

  return replaceLanePoints(lane, [...lane.points, normalizedPoint]);
}

export function moveAutomationPoint({
  lane,
  pointId,
  timeSeconds,
  value,
}: MoveAutomationPointRequest): AutomationLaneState {
  const pointIndex = lane.points.findIndex(point => point.id === pointId);
  if (pointIndex < 0) {
    return replaceLanePoints(lane, lane.points);
  }

  const previousPoint = lane.points[pointIndex - 1];
  const nextPoint = lane.points[pointIndex + 1];
  const minimumTime = previousPoint ? previousPoint.timeSeconds + MINIMUM_POINT_INTERVAL_SECONDS : 0;
  const maximumTime = nextPoint
    ? Math.max(minimumTime, nextPoint.timeSeconds - MINIMUM_POINT_INTERVAL_SECONDS)
    : Number.POSITIVE_INFINITY;
  const boundedTime = Math.min(maximumTime, Math.max(minimumTime, normalizeTimeSeconds(timeSeconds)));

  return replaceLanePoints(
    lane,
    lane.points.map(point =>
      point.id === pointId
        ? {
            ...point,
            timeSeconds: boundedTime,
            value: normalizeValue(value),
          }
        : point
    )
  );
}

export function deleteAutomationPoints({ lane, pointIds }: EditAutomationPointsRequest): AutomationLaneState {
  return replaceLanePoints(
    lane,
    lane.points.filter(point => !pointIds.has(point.id))
  );
}

export function copyAutomationPoints({ lane, pointIds }: EditAutomationPointsRequest): AutomationPointClipboard {
  const copiedPoints = lane.points.filter(point => pointIds.has(point.id));
  const firstTimeSeconds = copiedPoints[0]?.timeSeconds ?? 0;
  return {
    points: copiedPoints.map(point => ({
      interpolation: point.interpolation,
      offsetSeconds: point.timeSeconds - firstTimeSeconds,
      value: point.value,
    })),
  };
}

export function pasteAutomationPoints({
  clipboard,
  createId,
  lane,
  startTimeSeconds,
}: PasteAutomationPointsRequest): AutomationLaneState {
  const occupiedTimes = lane.points.map(point => point.timeSeconds);
  const pastedPoints = clipboard.points.map(point => {
    const requestedTime = normalizeTimeSeconds(startTimeSeconds) + point.offsetSeconds;
    const timeSeconds = findAvailableTime(requestedTime, occupiedTimes);
    occupiedTimes.push(timeSeconds);
    return {
      id: createId(),
      interpolation: point.interpolation,
      timeSeconds,
      value: normalizeValue(point.value),
    };
  });

  return replaceLanePoints(lane, [...lane.points, ...pastedPoints]);
}

export function eraseAutomationRange({
  endTimeSeconds,
  lane,
  startTimeSeconds,
}: EraseAutomationRangeRequest): AutomationLaneState {
  const rangeStart = Math.min(startTimeSeconds, endTimeSeconds);
  const rangeEnd = Math.max(startTimeSeconds, endTimeSeconds);
  return replaceLanePoints(
    lane,
    lane.points.filter(point => point.timeSeconds < rangeStart || point.timeSeconds > rangeEnd)
  );
}

function normalizeAutomationPoint(point: AutomationPointState): AutomationPointState {
  return {
    ...point,
    timeSeconds: normalizeTimeSeconds(point.timeSeconds),
    value: normalizeValue(point.value),
  };
}

function normalizeTimeSeconds(timeSeconds: number): number {
  return Number.isFinite(timeSeconds) ? Math.max(0, timeSeconds) : 0;
}

function normalizeValue(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function replaceLanePoints(lane: AutomationLaneState, points: readonly AutomationPointState[]): AutomationLaneState {
  return {
    ...lane,
    points: [...points].sort((left, right) => left.timeSeconds - right.timeSeconds),
  };
}

function findAvailableTime(requestedTime: number, occupiedTimes: readonly number[]): number {
  let timeSeconds = requestedTime;
  while (occupiedTimes.some(occupiedTime => Math.abs(occupiedTime - timeSeconds) < MINIMUM_POINT_INTERVAL_SECONDS)) {
    timeSeconds += MINIMUM_POINT_INTERVAL_SECONDS;
  }
  return timeSeconds;
}
