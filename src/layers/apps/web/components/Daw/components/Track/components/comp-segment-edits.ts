import type { CompSegmentState } from '@/layers/shared/types/multitrack-recording';
import type { TimelineRange } from '@/layers/shared/types/project-document.schema';

interface ReplaceCompRangeRequest {
  readonly createId: () => string;
  readonly currentSegments: readonly CompSegmentState[];
  readonly range: TimelineRange;
  readonly takeId: string;
}

export function replaceCompRange({
  createId,
  currentSegments,
  range,
  takeId,
}: ReplaceCompRangeRequest): CompSegmentState[] {
  if (range.endTimeSeconds <= range.startTimeSeconds) {
    throw new RangeError('Comp 범위 끝은 시작보다 커야 합니다.');
  }

  const preservedSegments = currentSegments.flatMap(segment => {
    if (segment.endTimeSeconds <= range.startTimeSeconds || segment.startTimeSeconds >= range.endTimeSeconds) {
      return [{ ...segment }];
    }

    const fragments: CompSegmentState[] = [];
    if (segment.startTimeSeconds < range.startTimeSeconds) {
      fragments.push({ ...segment, endTimeSeconds: range.startTimeSeconds });
    }
    if (segment.endTimeSeconds > range.endTimeSeconds) {
      fragments.push({ ...segment, id: createId(), startTimeSeconds: range.endTimeSeconds });
    }
    return fragments;
  });

  return [
    ...preservedSegments,
    {
      endTimeSeconds: range.endTimeSeconds,
      id: createId(),
      startTimeSeconds: range.startTimeSeconds,
      takeId,
    },
  ].sort((left, right) => left.startTimeSeconds - right.startTimeSeconds);
}
