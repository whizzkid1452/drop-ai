import type { AutomationLaneState, AutomationPointState } from './types/automation-state';
import type { TimelineRange } from './types/project-document.schema';

export const AutomationWritePassErrorCode = {
  DUPLICATE_POINT_ID: 'DUPLICATE_POINT_ID',
  EMPTY_SAMPLES: 'EMPTY_SAMPLES',
  INVALID_PASS_RANGE: 'INVALID_PASS_RANGE',
  READ_ONLY_LANE: 'READ_ONLY_LANE',
  SAMPLES_NOT_INCREASING: 'SAMPLES_NOT_INCREASING',
  SAMPLE_OUTSIDE_PASS_RANGE: 'SAMPLE_OUTSIDE_PASS_RANGE',
} as const;

export type AutomationWritePassErrorCode =
  (typeof AutomationWritePassErrorCode)[keyof typeof AutomationWritePassErrorCode];

export class AutomationWritePassError extends Error {
  constructor(
    readonly code: AutomationWritePassErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'AutomationWritePassError';
  }
}

export interface ApplyAutomationWritePassRequest {
  readonly lane: AutomationLaneState;
  readonly passRange: TimelineRange;
  readonly samples: readonly AutomationPointState[];
}

interface ReplacementRange {
  readonly endTimeSeconds: number;
  readonly startTimeSeconds: number;
}

export function applyAutomationWritePass({
  lane,
  passRange,
  samples,
}: ApplyAutomationWritePassRequest): AutomationLaneState {
  validateWritePass({ lane, passRange, samples });
  const replacementRange = resolveReplacementRange({ lane, passRange, samples });
  const preservedPoints = lane.points.filter(
    point =>
      point.timeSeconds < replacementRange.startTimeSeconds || point.timeSeconds > replacementRange.endTimeSeconds
  );
  const nextPoints = [...preservedPoints.map(point => ({ ...point })), ...samples.map(sample => ({ ...sample }))].sort(
    (left, right) => left.timeSeconds - right.timeSeconds
  );
  assertUniquePointIds(nextPoints);

  return { ...lane, points: nextPoints, target: { ...lane.target } };
}

function validateWritePass({ lane, passRange, samples }: ApplyAutomationWritePassRequest): void {
  if (lane.mode === 'read') {
    throw new AutomationWritePassError(
      AutomationWritePassErrorCode.READ_ONLY_LANE,
      'Read mode Automation lane에는 write pass를 적용할 수 없습니다.'
    );
  }
  if (
    !Number.isFinite(passRange.startTimeSeconds) ||
    !Number.isFinite(passRange.endTimeSeconds) ||
    passRange.startTimeSeconds < 0 ||
    passRange.endTimeSeconds <= passRange.startTimeSeconds
  ) {
    throw new AutomationWritePassError(
      AutomationWritePassErrorCode.INVALID_PASS_RANGE,
      'Automation write pass 범위가 유효하지 않습니다.'
    );
  }
  if (samples.length === 0) {
    throw new AutomationWritePassError(
      AutomationWritePassErrorCode.EMPTY_SAMPLES,
      'Automation write pass에는 sample이 하나 이상 필요합니다.'
    );
  }

  samples.forEach((sample, index) => {
    if (sample.timeSeconds < passRange.startTimeSeconds || sample.timeSeconds > passRange.endTimeSeconds) {
      throw new AutomationWritePassError(
        AutomationWritePassErrorCode.SAMPLE_OUTSIDE_PASS_RANGE,
        'Automation sample 시간이 write pass 범위를 벗어났습니다.'
      );
    }
    if (index > 0 && sample.timeSeconds <= samples[index - 1].timeSeconds) {
      throw new AutomationWritePassError(
        AutomationWritePassErrorCode.SAMPLES_NOT_INCREASING,
        'Automation sample 시간은 오름차순이며 중복되지 않아야 합니다.'
      );
    }
  });
}

function resolveReplacementRange({ lane, passRange, samples }: ApplyAutomationWritePassRequest): ReplacementRange {
  const firstSampleTimeSeconds = samples[0].timeSeconds;
  const lastSampleTimeSeconds = samples[samples.length - 1].timeSeconds;
  if (lane.mode === 'touch') {
    return { endTimeSeconds: lastSampleTimeSeconds, startTimeSeconds: firstSampleTimeSeconds };
  }
  if (lane.mode === 'latch') {
    return { endTimeSeconds: passRange.endTimeSeconds, startTimeSeconds: firstSampleTimeSeconds };
  }
  return { ...passRange };
}

function assertUniquePointIds(points: readonly AutomationPointState[]): void {
  const pointIds = new Set<string>();
  points.forEach(point => {
    if (pointIds.has(point.id)) {
      throw new AutomationWritePassError(
        AutomationWritePassErrorCode.DUPLICATE_POINT_ID,
        `Automation point ID가 중복되었습니다: ${point.id}`
      );
    }
    pointIds.add(point.id);
  });
}
