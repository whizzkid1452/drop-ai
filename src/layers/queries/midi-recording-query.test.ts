import { describe, expect, it, vi } from 'vitest';
import { MidiRecordingQuery } from './midi-recording-query';

describe('MidiRecordingQuery', () => {
  it('동일한 runtime 상태는 같은 snapshot으로 반환한다', () => {
    const source = {
      getRecordingState: vi.fn(() => ({
        capturedEventCount: 2,
        inputChannel: 1,
        inputId: 'input-1',
        isRecording: true,
        trackId: 'track-1',
      })),
      subscribeRecordingState: vi.fn(() => vi.fn()),
    };
    const query = new MidiRecordingQuery(source);

    expect(query.readState()).toEqual({
      capturedEventCount: 2,
      inputChannel: 1,
      inputId: 'input-1',
      isRecording: true,
      trackId: 'track-1',
    });
    expect(query.readState()).toBe(query.readState());
  });

  it('runtime 상태 알림을 구독하고 해제한다', () => {
    const unsubscribeSource = vi.fn();
    const source = {
      getRecordingState: vi.fn(() => ({
        capturedEventCount: 0,
        inputChannel: null,
        inputId: null,
        isRecording: false,
        trackId: null,
      })),
      subscribeRecordingState: vi.fn((listener: () => void) => {
        listener();
        return unsubscribeSource;
      }),
    };
    const listener = vi.fn();
    const query = new MidiRecordingQuery(source);

    const unsubscribe = query.subscribe(listener);
    unsubscribe();

    expect(listener).toHaveBeenCalledOnce();
    expect(unsubscribeSource).toHaveBeenCalledOnce();
  });
});
