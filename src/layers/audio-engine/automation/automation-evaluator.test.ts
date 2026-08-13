import { describe, expect, it } from 'vitest';
import type { AutomationLaneState } from '../../shared/types/automation-state';
import { createAutomationRenderPlan, evaluateAutomationLane } from './automation-evaluator';

const LANE: AutomationLaneState = {
  id: '11111111-1111-4111-8111-111111111111',
  isEnabled: true,
  mode: 'read',
  target: { kind: 'trackVolume' },
  points: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      interpolation: 'linear',
      timeSeconds: 0,
      value: 0,
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      interpolation: 'hold',
      timeSeconds: 2,
      value: 1,
    },
    {
      id: '44444444-4444-4444-8444-444444444444',
      interpolation: 'linear',
      timeSeconds: 4,
      value: 0.25,
    },
  ],
};

describe('Automation evaluator', () => {
  it('두 point 사이 값을 이전 point의 보간 방식으로 계산한다', () => {
    expect(evaluateAutomationLane({ lane: LANE, timeSeconds: 1 })).toBe(0.5);
    expect(evaluateAutomationLane({ lane: LANE, timeSeconds: 3 })).toBe(1);
  });

  it('재생 시작 위치부터 필요한 segment만 만든다', () => {
    expect(createAutomationRenderPlan({ lane: LANE, startTimeSeconds: 1 })).toEqual({
      initialValue: 0.5,
      segments: [
        {
          endTimeSeconds: 2,
          endValue: 1,
          interpolation: 'linear',
          startTimeSeconds: 1,
          startValue: 0.5,
        },
        {
          endTimeSeconds: 4,
          endValue: 0.25,
          interpolation: 'hold',
          startTimeSeconds: 2,
          startValue: 1,
        },
      ],
    });
  });

  it('렌더 범위 끝이 point 사이이면 보간된 끝값까지 segment를 만든다', () => {
    expect(createAutomationRenderPlan({ endTimeSeconds: 1.5, lane: LANE, startTimeSeconds: 1 })).toEqual({
      initialValue: 0.5,
      segments: [
        {
          endTimeSeconds: 1.5,
          endValue: 0.75,
          interpolation: 'linear',
          startTimeSeconds: 1,
          startValue: 0.5,
        },
      ],
    });
  });
});
