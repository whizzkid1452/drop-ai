import type { AutomationLaneState } from '../../shared/types/automation-state';
import { createAutomationRenderPlan, interpolateAutomationValue } from './automation-evaluator';

const AUTOMATION_CURVE_SAMPLE_COUNT = 33;

export interface IAutomationAudioTarget {
  cancelScheduledValues(audioTimeSeconds: number): void;
  linearRampToValueAtTime(value: number, audioTimeSeconds: number): void;
  restoreBaseValue(audioTimeSeconds: number): void;
  setValueAtTime(value: number, audioTimeSeconds: number): void;
  setValueCurveAtTime(values: readonly number[], audioTimeSeconds: number, durationSeconds: number): void;
}

export interface ScheduleAutomationLaneRequest {
  readonly audioStartTimeSeconds: number;
  readonly lane: AutomationLaneState;
  readonly target: IAutomationAudioTarget;
  readonly timelineEndTimeSeconds?: number;
  readonly timelineStartTimeSeconds: number;
}

export function scheduleAutomationLane({
  audioStartTimeSeconds,
  lane,
  target,
  timelineEndTimeSeconds,
  timelineStartTimeSeconds,
}: ScheduleAutomationLaneRequest): void {
  const plan = createAutomationRenderPlan({
    endTimeSeconds: timelineEndTimeSeconds,
    lane,
    startTimeSeconds: timelineStartTimeSeconds,
  });
  target.cancelScheduledValues(audioStartTimeSeconds);
  if (!lane.isEnabled || plan.initialValue === null) {
    target.restoreBaseValue(audioStartTimeSeconds);
    return;
  }

  target.setValueAtTime(plan.initialValue, audioStartTimeSeconds);
  plan.segments.forEach(segment => {
    const segmentAudioStart = audioStartTimeSeconds + segment.startTimeSeconds - timelineStartTimeSeconds;
    const segmentAudioEnd = audioStartTimeSeconds + segment.endTimeSeconds - timelineStartTimeSeconds;
    const durationSeconds = segmentAudioEnd - segmentAudioStart;

    if (segment.interpolation === 'hold') {
      target.setValueAtTime(segment.endValue, segmentAudioEnd);
      return;
    }
    if (segment.interpolation === 'linear') {
      target.linearRampToValueAtTime(segment.endValue, segmentAudioEnd);
      return;
    }
    target.setValueCurveAtTime(
      createSegmentCurve({
        endValue: segment.endValue,
        interpolation: segment.interpolation,
        startValue: segment.startValue,
      }),
      segmentAudioStart,
      durationSeconds
    );
  });
}

function createSegmentCurve({
  endValue,
  interpolation,
  startValue,
}: Pick<
  ReturnType<typeof createAutomationRenderPlan>['segments'][number],
  'endValue' | 'interpolation' | 'startValue'
>): number[] {
  return Array.from({ length: AUTOMATION_CURVE_SAMPLE_COUNT }, (_, index) =>
    interpolateAutomationValue({
      endValue,
      interpolation,
      progress: index / (AUTOMATION_CURVE_SAMPLE_COUNT - 1),
      startValue,
    })
  );
}
