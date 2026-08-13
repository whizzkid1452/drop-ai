import { describe, expect, it, vi } from 'vitest';
import { AudioMonitorQuery } from './audio-monitor-query';

describe('AudioMonitorQuery', () => {
  it('runtime Monitor 상태를 안정적인 읽기 전용 snapshot으로 반환한다', () => {
    const source = {
      getMonitorState: vi.fn(() => ({ isCut: false, isDimmed: true, isMono: false })),
      subscribeMonitorState: vi.fn(() => vi.fn()),
    };
    const query = new AudioMonitorQuery(source);

    expect(query.readState()).toEqual({ isCut: false, isDimmed: true, isMono: false });
    expect(query.readState()).toBe(query.readState());
  });

  it('runtime Monitor 상태 변경 알림을 구독하고 해제한다', () => {
    const unsubscribeSource = vi.fn();
    const source = {
      getMonitorState: vi.fn(() => ({ isCut: false, isDimmed: false, isMono: false })),
      subscribeMonitorState: vi.fn((listener: () => void) => {
        listener();
        return unsubscribeSource;
      }),
    };
    const query = new AudioMonitorQuery(source);
    const listener = vi.fn();

    const unsubscribe = query.subscribe(listener);
    unsubscribe();

    expect(listener).toHaveBeenCalledOnce();
    expect(unsubscribeSource).toHaveBeenCalledOnce();
  });
});
