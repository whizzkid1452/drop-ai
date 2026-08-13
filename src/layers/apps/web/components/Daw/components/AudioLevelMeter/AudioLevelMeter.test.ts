// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MeterFrame, MeterTarget } from '@/layers/shared/types/meter-frame';
import { AudioLevelMeter } from './AudioLevelMeter';
import { resolveMeterDisplay } from './audio-level-meter-display';

const meterMocks = vi.hoisted(() => ({
  frame: {
    capturedAtSeconds: 1,
    channels: [{ isClipHeld: false, peakDbfs: -12, rmsDbfs: -18 }],
  } as MeterFrame,
  query: { read: vi.fn<(target: MeterTarget) => MeterFrame>() },
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useMeterQuery: () => meterMocks.query,
}));

vi.mock('./AudioLevelMeter.css.ts', () => ({
  clip: 'clip',
  label: 'label',
  meter: 'meter',
  peakBar: 'peakBar',
  rmsBar: 'rmsBar',
  scale: 'scale',
}));

const mountedRoots: Root[] = [];
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
  vi.useRealTimers();
  meterMocks.query.read.mockReset();
});

describe('AudioLevelMeter', () => {
  it('여러 채널 중 가장 큰 peak와 RMS를 표시 범위로 변환한다', () => {
    expect(
      resolveMeterDisplay({
        capturedAtSeconds: 1,
        channels: [
          { isClipHeld: false, peakDbfs: -24, rmsDbfs: -30 },
          { isClipHeld: true, peakDbfs: -3, rmsDbfs: -9 },
        ],
      })
    ).toEqual({ isClipHeld: true, peakDbfs: -3, peakPercent: 95, rmsDbfs: -9, rmsPercent: 85 });
  });

  it('Query를 주기적으로 읽어 접근 가능한 meter 값과 clip hold를 갱신한다', () => {
    vi.useFakeTimers();
    meterMocks.query.read.mockImplementation(() => meterMocks.frame);
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mountedRoots.push(root);

    act(() =>
      root.render(
        createElement(AudioLevelMeter, { label: 'Track output', target: { kind: 'track', trackId: 'track-1' } })
      )
    );
    const meter = host.querySelector<HTMLElement>('[role="meter"]');

    expect(meterMocks.query.read).toHaveBeenCalledWith({ kind: 'track', trackId: 'track-1' });
    expect(meter?.getAttribute('aria-valuenow')).toBe('-12');
    expect(meter?.dataset.peakDbfs).toBe('-12');

    meterMocks.frame = {
      capturedAtSeconds: 2,
      channels: [{ isClipHeld: true, peakDbfs: -1, rmsDbfs: -6 }],
    };
    act(() => vi.advanceTimersByTime(50));

    expect(meter?.dataset.clipped).toBe('true');
    expect(meter?.dataset.peakDbfs).toBe('-1');
  });
});
