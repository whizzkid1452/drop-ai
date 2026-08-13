import { describe, expect, it, vi } from 'vitest';
import type { AutomationLaneState } from '../../shared/types/automation-state';
import { scheduleAutomationLane, type IAutomationAudioTarget } from './automation-param-scheduler';

function createTarget(): IAutomationAudioTarget {
  return {
    cancelScheduledValues: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    restoreBaseValue: vi.fn(),
    setValueAtTime: vi.fn(),
    setValueCurveAtTime: vi.fn(),
  };
}

function createLane(interpolation: AutomationLaneState['points'][number]['interpolation']): AutomationLaneState {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    isEnabled: true,
    mode: 'read',
    target: { kind: 'trackVolume' },
    points: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        interpolation,
        timeSeconds: 0,
        value: 0,
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        interpolation: 'hold',
        timeSeconds: 2,
        value: 1,
      },
    ],
  };
}

describe('Automation AudioParam scheduler', () => {
  it('재생 시작 위치를 AudioContext 시작 시각으로 옮겨 linear ramp를 예약한다', () => {
    const target = createTarget();

    scheduleAutomationLane({
      audioStartTimeSeconds: 10,
      lane: createLane('linear'),
      target,
      timelineStartTimeSeconds: 1,
    });

    expect(target.cancelScheduledValues).toHaveBeenCalledWith(10);
    expect(target.setValueAtTime).toHaveBeenCalledWith(0.5, 10);
    expect(target.linearRampToValueAtTime).toHaveBeenCalledWith(1, 11);
  });

  it('비선형 보간은 같은 계산식으로 만든 value curve를 예약한다', () => {
    const target = createTarget();

    scheduleAutomationLane({
      audioStartTimeSeconds: 5,
      lane: createLane('curved'),
      target,
      timelineStartTimeSeconds: 0,
    });

    expect(target.setValueCurveAtTime).toHaveBeenCalledWith(expect.arrayContaining([0, 0.5, 1]), 5, 2);
  });

  it('렌더 범위 끝이 point 사이이면 계산한 끝값까지 ramp를 예약한다', () => {
    const target = createTarget();

    scheduleAutomationLane({
      audioStartTimeSeconds: 10,
      lane: createLane('linear'),
      target,
      timelineEndTimeSeconds: 1.5,
      timelineStartTimeSeconds: 1,
    });

    expect(target.linearRampToValueAtTime).toHaveBeenCalledWith(0.75, 10.5);
  });
});
