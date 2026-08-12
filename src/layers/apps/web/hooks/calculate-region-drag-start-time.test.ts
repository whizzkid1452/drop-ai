import { describe, expect, it } from 'vitest';
import { calculateRegionDragStartTime } from './calculate-region-drag-start-time';
import { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';

const coordinateMapper = new TimelineCoordinateMapper({
  tempoBpm: 120,
  beatsPerBar: 4,
  beatUnit: 4,
  pixelsPerQuarterNote: 50,
});

describe('Region 드래그 위치 계산', () => {
  it('가로 이동 픽셀을 타임라인 초로 변환한다', () => {
    expect(
      calculateRegionDragStartTime({
        initialStartTime: 2,
        initialPointerX: 100,
        currentPointerX: 150,
        coordinateMapper,
      })
    ).toBe(2.5);
  });

  it('타임라인 0초보다 왼쪽으로 이동하지 않는다', () => {
    expect(
      calculateRegionDragStartTime({
        initialStartTime: 1,
        initialPointerX: 200,
        currentPointerX: 0,
        coordinateMapper,
      })
    ).toBe(0);
  });
});
