import { describe, expect, it, vi } from 'vitest';
import { RecordingQuery } from './recording-query';

describe('RecordingQuery', () => {
  it('동일한 runtime 상태는 같은 snapshot으로 반환한다', () => {
    const source = {
      getRecordingState: vi.fn(() => ({
        armedTrackId: 'track-1',
        phase: 'idle' as const,
        recordStartTimeSeconds: null,
      })),
      subscribeRecordingState: vi.fn(() => vi.fn()),
    };
    const query = new RecordingQuery(source);

    expect(query.readState()).toEqual({ armedTrackId: 'track-1', phase: 'idle', recordStartTimeSeconds: null });
    expect(query.readState()).toBe(query.readState());
  });

  it('runtime 상태 알림을 구독하고 해제한다', () => {
    const unsubscribeSource = vi.fn();
    const source = {
      getRecordingState: vi.fn(() => ({ armedTrackId: null, phase: 'idle' as const, recordStartTimeSeconds: null })),
      subscribeRecordingState: vi.fn((listener: () => void) => {
        listener();
        return unsubscribeSource;
      }),
    };
    const listener = vi.fn();
    const query = new RecordingQuery(source);

    const unsubscribe = query.subscribe(listener);
    unsubscribe();

    expect(listener).toHaveBeenCalledOnce();
    expect(unsubscribeSource).toHaveBeenCalledOnce();
  });
});
