import { describe, expect, it } from 'vitest';
import type { AutomationLaneState, AutomationPointState } from './types/automation-state';
import {
  applyAutomationWritePass,
  AutomationWritePassError,
  AutomationWritePassErrorCode,
} from './automation-write-pass';

const ORIGINAL_POINTS: readonly AutomationPointState[] = [
  { id: 'point-0', interpolation: 'linear', timeSeconds: 0, value: 0 },
  { id: 'point-2', interpolation: 'linear', timeSeconds: 2, value: 0.2 },
  { id: 'point-3', interpolation: 'linear', timeSeconds: 3, value: 0.3 },
  { id: 'point-4', interpolation: 'linear', timeSeconds: 4, value: 0.4 },
  { id: 'point-6', interpolation: 'linear', timeSeconds: 6, value: 0.6 },
];
const SAMPLES: readonly AutomationPointState[] = [
  { id: 'sample-1', interpolation: 'linear', timeSeconds: 2.5, value: 0.8 },
  { id: 'sample-2', interpolation: 'linear', timeSeconds: 3.5, value: 0.9 },
];

function createLane(mode: AutomationLaneState['mode']): AutomationLaneState {
  return {
    id: 'lane-1',
    isEnabled: true,
    mode,
    points: ORIGINAL_POINTS,
    target: { kind: 'trackVolume' },
  };
}

describe('applyAutomationWritePass', () => {
  it('Read mode에서는 write pass를 거부한다', () => {
    expect(() =>
      applyAutomationWritePass({
        lane: createLane('read'),
        passRange: { endTimeSeconds: 5, startTimeSeconds: 1 },
        samples: SAMPLES,
      })
    ).toThrowError(
      expect.objectContaining<Partial<AutomationWritePassError>>({ code: AutomationWritePassErrorCode.READ_ONLY_LANE })
    );
  });

  it('Touch mode는 첫 sample과 마지막 sample 사이만 교체한다', () => {
    const lane = applyAutomationWritePass({
      lane: createLane('touch'),
      passRange: { endTimeSeconds: 5, startTimeSeconds: 1 },
      samples: SAMPLES,
    });

    expect(lane.points.map(point => point.id)).toEqual([
      'point-0',
      'point-2',
      'sample-1',
      'sample-2',
      'point-4',
      'point-6',
    ]);
  });

  it('Latch mode는 첫 sample부터 pass 끝까지 교체한다', () => {
    const lane = applyAutomationWritePass({
      lane: createLane('latch'),
      passRange: { endTimeSeconds: 5, startTimeSeconds: 1 },
      samples: SAMPLES,
    });

    expect(lane.points.map(point => point.id)).toEqual(['point-0', 'point-2', 'sample-1', 'sample-2', 'point-6']);
  });

  it('Write mode는 pass 전체를 교체한다', () => {
    const lane = applyAutomationWritePass({
      lane: createLane('write'),
      passRange: { endTimeSeconds: 5, startTimeSeconds: 1 },
      samples: SAMPLES,
    });

    expect(lane.points.map(point => point.id)).toEqual(['point-0', 'sample-1', 'sample-2', 'point-6']);
  });

  it('sample 시간이 pass 범위를 벗어나면 거부한다', () => {
    expect(() =>
      applyAutomationWritePass({
        lane: createLane('write'),
        passRange: { endTimeSeconds: 5, startTimeSeconds: 3 },
        samples: SAMPLES,
      })
    ).toThrowError(
      expect.objectContaining<Partial<AutomationWritePassError>>({
        code: AutomationWritePassErrorCode.SAMPLE_OUTSIDE_PASS_RANGE,
      })
    );
  });
});
