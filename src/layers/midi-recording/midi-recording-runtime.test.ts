import { describe, expect, it, vi } from 'vitest';
import type { MidiInputEvent } from '../midi-input/i-midi-input';
import { MidiRecordingRuntime } from './midi-recording-runtime';

function createIdFactory() {
  let nextId = 1;
  return () => `${String(nextId++).padStart(8, '0')}-0000-4000-8000-000000000000`;
}

describe('MidiRecordingRuntime', () => {
  it('Note와 CC를 같은 시간 도메인의 Region으로 확정한다', () => {
    let monotonicTimeSeconds = 10;
    const runtime = new MidiRecordingRuntime({
      createId: createIdFactory(),
      nowSeconds: () => monotonicTimeSeconds,
    });
    const listener = vi.fn();
    runtime.subscribe(listener);
    runtime.start({
      inputChannel: null,
      inputId: null,
      loopRange: null,
      punchRange: null,
      startedAtSeconds: 1,
      trackId: 'track-1',
    });

    runtime.capture({
      event: { channel: 1, inputId: 'input-1', note: 60, type: 'noteOn', velocity: 100 },
      transportTimeSeconds: 1.25,
    });
    runtime.capture({
      event: {
        channel: 1,
        controllerNumber: 74,
        inputId: 'input-1',
        type: 'controlChange',
        value: 96,
      },
      transportTimeSeconds: 1.5,
    });
    monotonicTimeSeconds = 10.5;
    runtime.capture({
      event: { channel: 1, inputId: 'input-1', note: 60, type: 'noteOff', velocity: 64 },
      transportTimeSeconds: 1.75,
    });

    const take = runtime.stop({ stoppedAtSeconds: 2 });

    expect(take).toMatchObject({
      capturedEventCount: 3,
      region: {
        controlLanes: [
          {
            channel: 1,
            controllerNumber: 74,
            points: [{ timeOffsetSeconds: 0.5, value: 96 }],
            type: 'controlChange',
          },
        ],
        durationSeconds: 1,
        notes: [{ durationSeconds: 0.5, pitch: 60, startOffsetSeconds: 0.25, velocity: 100 }],
        startTimeSeconds: 1,
      },
      trackId: 'track-1',
    });
    expect(listener).toHaveBeenCalled();
    expect(runtime.getState().isRecording).toBe(false);
  });

  it('입력 route와 Punch Range 밖의 이벤트를 제외한다', () => {
    const runtime = new MidiRecordingRuntime({ createId: createIdFactory(), nowSeconds: () => 10 });
    runtime.start({
      inputChannel: 2,
      inputId: 'input-2',
      loopRange: null,
      punchRange: { endTimeSeconds: 4, startTimeSeconds: 2 },
      startedAtSeconds: 0,
      trackId: 'track-1',
    });
    const events: MidiInputEvent[] = [
      { channel: 1, inputId: 'input-2', note: 60, type: 'noteOn', velocity: 100 },
      { channel: 2, inputId: 'input-1', note: 61, type: 'noteOn', velocity: 100 },
      { channel: 2, inputId: 'input-2', note: 62, type: 'noteOn', velocity: 100 },
    ];

    runtime.capture({ event: events[0] as MidiInputEvent, transportTimeSeconds: 2.5 });
    runtime.capture({ event: events[1] as MidiInputEvent, transportTimeSeconds: 2.5 });
    runtime.capture({ event: events[2] as MidiInputEvent, transportTimeSeconds: 1.5 });
    const take = runtime.stop({ stoppedAtSeconds: 4 });

    expect(take.capturedEventCount).toBe(0);
    expect(take.region).toBeNull();
  });

  it('Loop를 지난 transport 시간을 Loop Range 안으로 접는다', () => {
    let monotonicTimeSeconds = 10;
    const runtime = new MidiRecordingRuntime({ createId: createIdFactory(), nowSeconds: () => monotonicTimeSeconds });
    runtime.start({
      inputChannel: null,
      inputId: null,
      loopRange: { endTimeSeconds: 6, startTimeSeconds: 4 },
      punchRange: null,
      startedAtSeconds: 4,
      trackId: 'track-1',
    });
    runtime.capture({
      event: { channel: 1, inputId: 'input-1', note: 64, type: 'noteOn', velocity: 90 },
      transportTimeSeconds: 6.25,
    });
    monotonicTimeSeconds = 10.25;
    runtime.capture({
      event: { channel: 1, inputId: 'input-1', note: 64, type: 'noteOff', velocity: 0 },
      transportTimeSeconds: 6.5,
    });

    const take = runtime.stop({ stoppedAtSeconds: 6.5 });

    expect(take.region).toMatchObject({
      durationSeconds: 2,
      notes: [{ durationSeconds: 0.25, startOffsetSeconds: 0.25 }],
      startTimeSeconds: 4,
    });
  });

  it('Punch와 Loop가 함께 설정되면 Punch 시작점을 Region 원점으로 사용한다', () => {
    let monotonicTimeSeconds = 10;
    const runtime = new MidiRecordingRuntime({ createId: createIdFactory(), nowSeconds: () => monotonicTimeSeconds });
    runtime.start({
      inputChannel: null,
      inputId: null,
      loopRange: { endTimeSeconds: 8, startTimeSeconds: 0 },
      punchRange: { endTimeSeconds: 4, startTimeSeconds: 2 },
      startedAtSeconds: 0,
      trackId: 'track-1',
    });
    runtime.capture({
      event: { channel: 1, inputId: 'input-1', note: 64, type: 'noteOn', velocity: 90 },
      transportTimeSeconds: 2.5,
    });
    monotonicTimeSeconds = 10.25;
    runtime.capture({
      event: { channel: 1, inputId: 'input-1', note: 64, type: 'noteOff', velocity: 0 },
      transportTimeSeconds: 2.75,
    });

    const take = runtime.stop({ stoppedAtSeconds: 4 });

    expect(take.region).toMatchObject({
      durationSeconds: 2,
      notes: [{ durationSeconds: 0.25, startOffsetSeconds: 0.5 }],
      startTimeSeconds: 2,
    });
  });

  it('cancel은 수집 상태를 버리고 이후 stop을 거부한다', () => {
    const runtime = new MidiRecordingRuntime({ createId: createIdFactory(), nowSeconds: () => 10 });
    runtime.start({
      inputChannel: null,
      inputId: null,
      loopRange: null,
      punchRange: null,
      startedAtSeconds: 0,
      trackId: 'track-1',
    });
    runtime.cancel();

    expect(runtime.getState().isRecording).toBe(false);
    expect(() => runtime.stop({ stoppedAtSeconds: 1 })).toThrowError('진행 중인 MIDI 녹음');
  });
});
