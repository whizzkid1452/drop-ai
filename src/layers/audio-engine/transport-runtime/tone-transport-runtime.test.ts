import { beforeEach, describe, expect, it, vi } from 'vitest';

const toneMocks = vi.hoisted(() => ({
  bpmValue: 120,
  bpmSetValueAtTime: vi.fn(),
  clear: vi.fn(),
  loop: false,
  loopEnd: 0,
  loopStart: 0,
  schedule: vi.fn(),
  scheduleRepeat: vi.fn(),
  scheduledCallbacks: new Map<number, (time: number) => void>(),
  synthConnect: vi.fn(),
  synthTriggerAttackRelease: vi.fn(),
  synthVolume: 0,
}));

vi.mock('tone', () => {
  let eventId = 0;
  const bpm = {
    get value() {
      return toneMocks.bpmValue;
    },
    set value(value: number) {
      toneMocks.bpmValue = value;
    },
    setValueAtTime: toneMocks.bpmSetValueAtTime,
  };
  const transport = {
    bpm,
    clear: (id: number) => {
      toneMocks.clear(id);
      toneMocks.scheduledCallbacks.delete(id);
    },
    get loop() {
      return toneMocks.loop;
    },
    set loop(value: boolean) {
      toneMocks.loop = value;
    },
    get loopEnd() {
      return toneMocks.loopEnd;
    },
    set loopEnd(value: number) {
      toneMocks.loopEnd = value;
    },
    get loopStart() {
      return toneMocks.loopStart;
    },
    set loopStart(value: number) {
      toneMocks.loopStart = value;
    },
    schedule: (callback: (time: number) => void, time: number) => {
      eventId += 1;
      toneMocks.schedule(callback, time);
      toneMocks.scheduledCallbacks.set(eventId, callback);
      return eventId;
    },
    scheduleRepeat: (callback: (time: number) => void, interval: string) => {
      eventId += 1;
      toneMocks.scheduleRepeat(callback, interval);
      toneMocks.scheduledCallbacks.set(eventId, callback);
      return eventId;
    },
    seconds: 0,
  };

  class Synth {
    volume = {
      get value() {
        return toneMocks.synthVolume;
      },
      set value(value: number) {
        toneMocks.synthVolume = value;
      },
    };

    connect(destination: unknown) {
      toneMocks.synthConnect(destination);
      return this;
    }

    triggerAttackRelease(...args: unknown[]) {
      toneMocks.synthTriggerAttackRelease(...args);
    }
  }

  return {
    Synth,
    gainToDb: (gain: number) => gain * 100,
    getDestination: () => 'destination',
    getTransport: () => transport,
  };
});

import { ToneTransportRuntime } from './tone-transport-runtime';

describe('ToneTransportRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toneMocks.bpmValue = 120;
    toneMocks.loop = false;
    toneMocks.loopEnd = 0;
    toneMocks.loopStart = 0;
    toneMocks.scheduledCallbacks.clear();
    toneMocks.synthVolume = 0;
  });

  it('Tempo 변경을 계산된 Transport 초에 예약한다', () => {
    const runtime = new ToneTransportRuntime();

    runtime.setTempoMap({
      changes: [
        { bpm: 120, quarterNotePosition: 0 },
        { bpm: 60, quarterNotePosition: 4 },
      ],
    });

    expect(toneMocks.bpmValue).toBe(120);
    expect(toneMocks.schedule).toHaveBeenCalledWith(expect.any(Function), 0);
    expect(toneMocks.schedule).toHaveBeenCalledWith(expect.any(Function), 2);
    const scheduledTempoChange = toneMocks.schedule.mock.calls.find(([, time]) => time === 2);
    const callback = scheduledTempoChange?.[0] as ((time: number) => void) | undefined;
    callback?.(10);
    expect(toneMocks.bpmSetValueAtTime).toHaveBeenCalledWith(60, 10);
  });

  it('Loop 범위와 활성 상태를 Transport에 반영한다', () => {
    const runtime = new ToneTransportRuntime();

    runtime.setLoopRange({ endTimeSeconds: 8, startTimeSeconds: 2 });
    runtime.setLoopEnabled(true);

    expect(toneMocks.loopStart).toBe(2);
    expect(toneMocks.loopEnd).toBe(8);
    expect(toneMocks.loop).toBe(true);
  });

  it('Metronome을 quarter note 간격으로 예약하고 해제한다', () => {
    const runtime = new ToneTransportRuntime();
    runtime.setMetronomeVolume(0.5);

    runtime.setMetronomeEnabled(true);

    expect(toneMocks.scheduleRepeat).toHaveBeenCalledWith(expect.any(Function), '4n');
    const callback = [...toneMocks.scheduledCallbacks.values()][0];
    callback?.(10);
    expect(toneMocks.synthTriggerAttackRelease).toHaveBeenCalledWith('C6', '32n', 10);
    expect(toneMocks.synthVolume).toBe(50);

    runtime.setMetronomeEnabled(false);
    expect(toneMocks.clear).toHaveBeenCalledOnce();
  });
});
