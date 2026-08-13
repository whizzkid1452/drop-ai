import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutomationLaneState } from '../../shared/types/automation-state';
import type { IAutomationAudioTarget } from './automation-param-scheduler';

const toneMocks = vi.hoisted(() => ({
  clear: vi.fn(),
  contextTimeSeconds: 10,
  loopCallback: null as ((audioTimeSeconds: number) => void) | null,
  schedule: vi.fn((callback: (audioTimeSeconds: number) => void) => {
    toneMocks.loopCallback = callback;
    return 7;
  }),
  transportSeconds: 0,
}));

vi.mock('tone', () => ({
  getTransport: () => ({
    clear: toneMocks.clear,
    schedule: toneMocks.schedule,
    seconds: toneMocks.transportSeconds,
  }),
  now: () => toneMocks.contextTimeSeconds,
}));

import { ToneAutomationRuntime } from './tone-automation-runtime';

const LANE: AutomationLaneState = {
  id: '11111111-1111-4111-8111-111111111111',
  isEnabled: true,
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
  ],
  target: { kind: 'trackVolume' },
};

function createTarget(): IAutomationAudioTarget {
  return {
    cancelScheduledValues: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    restoreBaseValue: vi.fn(),
    setValueAtTime: vi.fn(),
    setValueCurveAtTime: vi.fn(),
  };
}

describe('ToneAutomationRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toneMocks.loopCallback = null;
  });

  it('Loop 시작 event에서 Loop 범위 끝의 보간값까지 다시 예약한다', () => {
    const target = createTarget();
    const runtime = new ToneAutomationRuntime({
      listTrackLanes: () => [{ automationLanes: [LANE], trackId: 'track-1' }],
      resolveTarget: () => target,
    });
    runtime.setLoopRange({ endTimeSeconds: 1.5, startTimeSeconds: 1 });
    runtime.setLoopEnabled(true);

    toneMocks.loopCallback?.(20);

    expect(toneMocks.schedule).toHaveBeenCalledWith(expect.any(Function), 1);
    expect(target.setValueAtTime).toHaveBeenCalledWith(0.5, 20);
    expect(target.linearRampToValueAtTime).toHaveBeenCalledWith(0.75, 20.5);
  });

  it('비활성 lane은 runtime 대상을 조회하지 않는다', () => {
    const resolveTarget = vi.fn(() => createTarget());
    const runtime = new ToneAutomationRuntime({
      listTrackLanes: () => [{ automationLanes: [{ ...LANE, isEnabled: false }], trackId: 'track-1' }],
      resolveTarget,
    });

    runtime.refresh();

    expect(resolveTarget).not.toHaveBeenCalled();
  });
});
