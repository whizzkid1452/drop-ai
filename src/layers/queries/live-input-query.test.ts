import { describe, expect, it, vi } from 'vitest';
import { LiveInputQuery } from './live-input-query';

describe('LiveInputQuery', () => {
  it('장치 목록과 runtime 상태를 읽기 전용 복사본으로 반환한다', async () => {
    const listeners = new Set<() => void>();
    const source = {
      getLiveInputState: vi.fn(() => ({ deviceId: 'mic-1', monitoringTrackId: 'track-1' })),
      listLiveInputDevices: vi.fn(async () => [{ deviceId: 'mic-1', label: 'Mic' }]),
      subscribeLiveInputState: vi.fn((listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }),
    };
    const query = new LiveInputQuery(source);

    await expect(query.listDevices()).resolves.toEqual([{ deviceId: 'mic-1', label: 'Mic' }]);
    expect(query.readState()).toEqual({ deviceId: 'mic-1', monitoringTrackId: 'track-1' });
    expect(query.readState()).toBe(query.readState());
  });

  it('runtime 상태 변경 알림을 구독하고 해제한다', () => {
    const unsubscribeSource = vi.fn();
    const source = {
      getLiveInputState: vi.fn(() => ({ deviceId: null, monitoringTrackId: null })),
      listLiveInputDevices: vi.fn(async () => []),
      subscribeLiveInputState: vi.fn((listener: () => void) => {
        listener();
        return unsubscribeSource;
      }),
    };
    const query = new LiveInputQuery(source);
    const listener = vi.fn();

    const unsubscribe = query.subscribe(listener);
    unsubscribe();

    expect(listener).toHaveBeenCalledOnce();
    expect(unsubscribeSource).toHaveBeenCalledOnce();
  });
});
