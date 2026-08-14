import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILTIN_MIDI_INSTRUMENT_ID } from '../../shared/types/midi-state';

const toneMocks = vi.hoisted(() => ({
  clear: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  dispose: vi.fn(),
  eventCallbacks: new Map<number, (time: number) => void>(),
  nextEventId: 1,
  releaseAll: vi.fn(),
  schedule: vi.fn((callback: (time: number) => void) => {
    const eventId = toneMocks.nextEventId;
    toneMocks.nextEventId += 1;
    toneMocks.eventCallbacks.set(eventId, callback);
    return eventId;
  }),
  triggerAttack: vi.fn(),
  triggerAttackRelease: vi.fn(),
  triggerRelease: vi.fn(),
}));

vi.mock('tone', () => {
  class PolySynth {
    connect(destination: unknown) {
      toneMocks.connect(destination);
      return this;
    }

    disconnect() {
      toneMocks.disconnect();
      return this;
    }

    dispose() {
      toneMocks.dispose();
      return this;
    }

    releaseAll() {
      toneMocks.releaseAll();
      return this;
    }

    triggerAttackRelease(frequency: number, duration: number, time: number, velocity: number) {
      toneMocks.triggerAttackRelease(frequency, duration, time, velocity);
      return this;
    }

    triggerAttack(frequency: number, time?: number, velocity?: number) {
      toneMocks.triggerAttack(frequency, time, velocity);
      return this;
    }

    triggerRelease(frequency: number, time?: number) {
      toneMocks.triggerRelease(frequency, time);
      return this;
    }
  }

  return {
    Frequency: (pitch: number) => ({ toFrequency: () => 440 * 2 ** ((pitch - 69) / 12) }),
    PolySynth,
    Synth: class Synth {},
    getTransport: () => ({ clear: toneMocks.clear, schedule: toneMocks.schedule }),
  };
});

import { ToneMidiRuntime } from './tone-midi-runtime';

describe('ToneMidiRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toneMocks.eventCallbacks.clear();
    toneMocks.nextEventId = 1;
  });

  it('Region 상대 시간을 Transport 절대 시간으로 예약한다', () => {
    const runtime = new ToneMidiRuntime();
    runtime.setTrackState({
      destination: {} as never,
      midi: {
        instrumentId: BUILTIN_MIDI_INSTRUMENT_ID,
        recordMode: 'replace',
        regions: [
          {
            controlLanes: [],
            durationSeconds: 2,
            id: '11111111-1111-4111-8111-111111111111',
            name: 'Verse',
            notes: [
              {
                channel: 1,
                durationSeconds: 0.5,
                id: '22222222-2222-4222-8222-222222222222',
                pitch: 69,
                startOffsetSeconds: 0.25,
                velocity: 64,
              },
            ],
            startTimeSeconds: 1,
          },
        ],
      },
      trackId: 'track-1',
    });

    expect(toneMocks.schedule).toHaveBeenCalledWith(expect.any(Function), 1.25);
    toneMocks.eventCallbacks.get(1)?.(3);
    expect(toneMocks.triggerAttackRelease).toHaveBeenCalledWith(440, 0.5, 3, 64 / 127);
  });

  it('Track 상태 교체 시 이전 event와 synth를 정리한다', () => {
    const runtime = new ToneMidiRuntime();
    const request = {
      destination: {} as never,
      midi: { instrumentId: BUILTIN_MIDI_INSTRUMENT_ID, recordMode: 'replace' as const, regions: [] },
      trackId: 'track-1',
    };
    runtime.setTrackState({
      ...request,
      midi: {
        ...request.midi,
        regions: [
          {
            controlLanes: [],
            durationSeconds: 1,
            id: '11111111-1111-4111-8111-111111111111',
            name: 'One',
            notes: [
              {
                channel: 1,
                durationSeconds: 0.25,
                id: '22222222-2222-4222-8222-222222222222',
                pitch: 60,
                startOffsetSeconds: 0,
                velocity: 100,
              },
            ],
            startTimeSeconds: 0,
          },
        ],
      },
    });

    runtime.setTrackState(request);

    expect(toneMocks.clear).toHaveBeenCalledWith(1);
    expect(toneMocks.releaseAll).toHaveBeenCalledTimes(1);
    expect(toneMocks.disconnect).toHaveBeenCalledTimes(1);
    expect(toneMocks.dispose).toHaveBeenCalledTimes(1);
  });

  it('실시간 Note On과 Note Off를 Track Instrument에 전달한다', () => {
    const runtime = new ToneMidiRuntime();
    runtime.setTrackState({
      destination: {} as never,
      midi: { instrumentId: BUILTIN_MIDI_INSTRUMENT_ID, recordMode: 'replace', regions: [] },
      trackId: 'track-1',
    });

    runtime.sendInputEvent({
      event: { channel: 1, inputId: 'input-1', note: 69, type: 'noteOn', velocity: 64 },
      trackId: 'track-1',
    });
    runtime.sendInputEvent({
      event: { channel: 1, inputId: 'input-1', note: 69, type: 'noteOff', velocity: 0 },
      trackId: 'track-1',
    });

    expect(toneMocks.triggerAttack).toHaveBeenCalledWith(440, undefined, 64 / 127);
    expect(toneMocks.triggerRelease).toHaveBeenCalledWith(440, undefined);
  });

  it('panic에서 모든 Track의 sounding note를 해제한다', () => {
    const runtime = new ToneMidiRuntime();
    runtime.setTrackState({
      destination: {} as never,
      midi: { instrumentId: BUILTIN_MIDI_INSTRUMENT_ID, recordMode: 'replace', regions: [] },
      trackId: 'track-1',
    });
    runtime.setTrackState({
      destination: {} as never,
      midi: { instrumentId: BUILTIN_MIDI_INSTRUMENT_ID, recordMode: 'replace', regions: [] },
      trackId: 'track-2',
    });

    runtime.panic();

    expect(toneMocks.releaseAll).toHaveBeenCalledTimes(2);
  });
});
