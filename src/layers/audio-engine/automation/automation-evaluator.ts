import type { AutomationInterpolation, AutomationLaneState } from '../../shared/types/automation-state';

export interface EvaluateAutomationLaneRequest {
  readonly lane: AutomationLaneState;
  readonly timeSeconds: number;
}

export interface AutomationRenderSegment {
  readonly endTimeSeconds: number;
  readonly endValue: number;
  readonly interpolation: AutomationInterpolation;
  readonly startTimeSeconds: number;
  readonly startValue: number;
}

export interface AutomationRenderPlan {
  readonly initialValue: number | null;
  readonly segments: readonly AutomationRenderSegment[];
}

export interface CreateAutomationRenderPlanRequest {
  readonly endTimeSeconds?: number;
  readonly lane: AutomationLaneState;
  readonly startTimeSeconds: number;
}

export function evaluateAutomationLane({ lane, timeSeconds }: EvaluateAutomationLaneRequest): number | null {
  const firstPoint = lane.points[0];
  if (!firstPoint) {
    return null;
  }
  if (timeSeconds <= firstPoint.timeSeconds) {
    return firstPoint.value;
  }

  const nextPointIndex = lane.points.findIndex(point => point.timeSeconds > timeSeconds);
  if (nextPointIndex < 0) {
    return lane.points[lane.points.length - 1]?.value ?? null;
  }

  const previousPoint = lane.points[nextPointIndex - 1];
  const nextPoint = lane.points[nextPointIndex];
  if (!previousPoint || !nextPoint) {
    return firstPoint.value;
  }
  const progress = (timeSeconds - previousPoint.timeSeconds) / (nextPoint.timeSeconds - previousPoint.timeSeconds);
  return interpolateAutomationValue({
    endValue: nextPoint.value,
    interpolation: previousPoint.interpolation,
    progress,
    startValue: previousPoint.value,
  });
}

export function createAutomationRenderPlan({
  endTimeSeconds = Number.POSITIVE_INFINITY,
  lane,
  startTimeSeconds,
}: CreateAutomationRenderPlanRequest): AutomationRenderPlan {
  const initialValue = evaluateAutomationLane({ lane, timeSeconds: startTimeSeconds });
  if (initialValue === null) {
    return { initialValue, segments: [] };
  }

  const futurePoints = lane.points.filter(
    point => point.timeSeconds > startTimeSeconds && point.timeSeconds <= endTimeSeconds
  );
  let segmentStartTime = startTimeSeconds;
  let segmentStartValue = initialValue;

  const segments = futurePoints.map(point => {
    const sourcePoint = findAutomationPointAtOrBefore(lane, segmentStartTime);
    const segment = {
      endTimeSeconds: point.timeSeconds,
      endValue: point.value,
      interpolation: sourcePoint?.interpolation ?? 'hold',
      startTimeSeconds: segmentStartTime,
      startValue: segmentStartValue,
    };
    segmentStartTime = point.timeSeconds;
    segmentStartValue = point.value;
    return segment;
  });
  const nextPoint = lane.points.find(point => point.timeSeconds > segmentStartTime);
  const shouldCompletePartialSegment =
    Number.isFinite(endTimeSeconds) &&
    endTimeSeconds > segmentStartTime &&
    nextPoint !== undefined &&
    endTimeSeconds < nextPoint.timeSeconds;
  if (shouldCompletePartialSegment) {
    const sourcePoint = findAutomationPointAtOrBefore(lane, segmentStartTime);
    segments.push({
      endTimeSeconds,
      endValue: evaluateAutomationLane({ lane, timeSeconds: endTimeSeconds }) ?? segmentStartValue,
      interpolation: sourcePoint?.interpolation ?? 'hold',
      startTimeSeconds: segmentStartTime,
      startValue: segmentStartValue,
    });
  }

  return {
    initialValue,
    segments,
  };
}

export function interpolateAutomationValue({
  endValue,
  interpolation,
  progress,
  startValue,
}: {
  readonly endValue: number;
  readonly interpolation: AutomationInterpolation;
  readonly progress: number;
  readonly startValue: number;
}): number {
  const boundedProgress = Math.min(1, Math.max(0, progress));
  const shapedProgress = getInterpolationProgress(interpolation, boundedProgress);
  return startValue + (endValue - startValue) * shapedProgress;
}

function findAutomationPointAtOrBefore(
  lane: AutomationLaneState,
  timeSeconds: number
): AutomationLaneState['points'][number] | undefined {
  return [...lane.points].reverse().find(point => point.timeSeconds <= timeSeconds) ?? lane.points[0];
}

function getInterpolationProgress(interpolation: AutomationInterpolation, progress: number): number {
  switch (interpolation) {
    case 'hold':
      return progress >= 1 ? 1 : 0;
    case 'linear':
      return progress;
    case 'exponential':
      return progress * progress;
    case 'logarithmic':
      return Math.sqrt(progress);
    case 'curved':
      return progress * progress * (3 - 2 * progress);
  }
}
