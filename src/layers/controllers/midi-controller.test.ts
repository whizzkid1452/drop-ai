import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
import type { IMidiInput, MidiInputEvent, MidiInputListener } from '../midi-input/i-midi-input';
import { createSessionStore, type SessionStore } from '../session/session';
import { BUILTIN_MIDI_INSTRUMENT_ID, type MidiTrackState } from '../shared/types/midi-state';
import { MidiController } from './midi-controller';
import { ProjectMutationCompensationError } from './project-mutation-compensation-error';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const REGION_ID = '22222222-2222-4222-8222-222222222222';
const NOTE_ID = '33333333-3333-4333-8333-333333333333';

const MIDI_STATE: MidiTrackState = {
  instrumentId: BUILTIN_MIDI_INSTRUMENT_ID,
  recordMode: 'replace',
  regions: [
    {
      controlLanes: [],
      durationSeconds: 2,
      id: REGION_ID,
      name: 'Verse',
      notes: [
        {
          channel: 1,
          durationSeconds: 0.5,
          id: NOTE_ID,
          pitch: 60,
          startOffsetSeconds: 0.25,
          velocity: 100,
        },
      ],
      startTimeSeconds: 1,
    },
  ],
};

describe('MidiController', () => {
  let audioEngine: MockAudioEngine;
  let emitMidiInput: (event: MidiInputEvent) => void;
  let midiInput: IMidiInput;
  let monotonicTimeSeconds: number;
  let sessionStore: SessionStore;
  let controller: MidiController;

  beforeEach(() => {
    audioEngine = new MockAudioEngine();
    let inputListener: MidiInputListener | null = null;
    midiInput = {
      connect: vi.fn().mockResolvedValue([]),
      disconnect: vi.fn(),
      subscribe: vi.fn(listener => {
        inputListener = listener;
        return () => {
          inputListener = null;
        };
      }),
    };
    emitMidiInput = event => inputListener?.(event);
    monotonicTimeSeconds = 10;
    sessionStore = createSessionStore({
      initialProjectMetadata: {
        id: '44444444-4444-4444-8444-444444444444',
        name: 'MIDI test',
        revision: 0,
      },
    });
    let nextId = 1;
    controller = new MidiController({
      audioEngine,
      createId: () => `${String(nextId++).padStart(8, '0')}-0000-4000-8000-000000000000`,
      midiInput,
      nowSeconds: () => monotonicTimeSeconds,
      sessionStore,
    });
  });

  it('runtime 생성 뒤 빈 MIDI Track을 Session에 추가한다', async () => {
    await controller.addTrack(TRACK_ID);

    expect(audioEngine.getMockMidiTrackState(TRACK_ID)).toEqual({
      instrumentId: BUILTIN_MIDI_INSTRUMENT_ID,
      recordMode: 'replace',
      regions: [],
    });
    expect(sessionStore.getState().tracks.get(TRACK_ID)?.midi).toEqual({
      instrumentId: BUILTIN_MIDI_INSTRUMENT_ID,
      recordMode: 'replace',
      regions: [],
    });
  });

  it('runtime 적용 뒤 Session에 독립된 MIDI 상태를 저장한다', async () => {
    await controller.addTrack(TRACK_ID);

    controller.setTrackState({ midi: MIDI_STATE, trackId: TRACK_ID });

    expect(audioEngine.getMockMidiTrackState(TRACK_ID)).toEqual(MIDI_STATE);
    expect(sessionStore.getState().tracks.get(TRACK_ID)?.midi).toEqual(MIDI_STATE);
    expect(sessionStore.getState().tracks.get(TRACK_ID)?.midi).not.toBe(MIDI_STATE);
  });

  it('Session 갱신 실패 시 runtime을 이전 MIDI 상태로 복원한다', async () => {
    await controller.addTrack(TRACK_ID);
    const setMidiTrackState = vi.spyOn(audioEngine, 'setMidiTrackState');
    vi.spyOn(sessionStore.getState(), 'updateTrack').mockImplementationOnce(() => {
      throw new Error('session update failed');
    });

    expect(() => controller.setTrackState({ midi: MIDI_STATE, trackId: TRACK_ID })).toThrowError(
      'session update failed'
    );
    expect(setMidiTrackState).toHaveBeenLastCalledWith({
      midi: { instrumentId: BUILTIN_MIDI_INSTRUMENT_ID, recordMode: 'replace', regions: [] },
      trackId: TRACK_ID,
    });
  });

  it('Session 갱신과 runtime 복원이 모두 실패하면 보상 실패를 보고한다', async () => {
    await controller.addTrack(TRACK_ID);
    vi.spyOn(audioEngine, 'setMidiTrackState')
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => {
        throw new Error('runtime restore failed');
      });
    vi.spyOn(sessionStore.getState(), 'updateTrack').mockImplementationOnce(() => {
      throw new Error('session update failed');
    });

    expect(() => controller.setTrackState({ midi: MIDI_STATE, trackId: TRACK_ID })).toThrowError(
      ProjectMutationCompensationError
    );
  });

  it('Audio Track의 MIDI 상태 변경을 거부한다', async () => {
    await audioEngine.addTrack(TRACK_ID);
    sessionStore.getState().addTrack({
      id: TRACK_ID,
      isMuted: false,
      isSoloed: false,
      midi: null,
      name: 'Audio',
      pan: 0,
      pluginInstances: [],
      regions: [],
      status: [],
      volume: 1,
    });

    expect(() => controller.setTrackState({ midi: MIDI_STATE, trackId: TRACK_ID })).toThrowError(
      expect.objectContaining({ code: 'TRACK_NOT_MIDI' })
    );
  });

  it('선택한 입력 route의 Note와 CC를 녹음해 MIDI Region으로 확정한다', async () => {
    await controller.addTrack(TRACK_ID);
    audioEngine.setTime(1);
    const sendMidiInputEvent = vi.spyOn(audioEngine, 'sendMidiInputEvent');

    await controller.startRecording({ inputChannel: 1, inputId: 'input-1', trackId: TRACK_ID });
    emitMidiInput({ channel: 2, inputId: 'input-1', note: 61, type: 'noteOn', velocity: 80 });
    audioEngine.setTime(1.25);
    emitMidiInput({ channel: 1, inputId: 'input-1', note: 60, type: 'noteOn', velocity: 100 });
    audioEngine.setTime(1.5);
    emitMidiInput({ channel: 1, controllerNumber: 74, inputId: 'input-1', type: 'controlChange', value: 96 });
    monotonicTimeSeconds = 10.5;
    audioEngine.setTime(1.75);
    emitMidiInput({ channel: 1, inputId: 'input-1', note: 60, type: 'noteOff', velocity: 64 });
    audioEngine.setTime(2);

    const take = controller.stopRecording(TRACK_ID);

    expect(take.capturedEventCount).toBe(3);
    expect(sessionStore.getState().tracks.get(TRACK_ID)?.midi?.regions).toMatchObject([
      {
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
    ]);
    expect(sendMidiInputEvent).toHaveBeenCalledTimes(3);
    expect(controller.getRecordingState().isRecording).toBe(false);
  });

  it('MIDI 입력 구독 실패 시 시작한 녹음 상태를 취소한다', async () => {
    await controller.addTrack(TRACK_ID);
    vi.mocked(midiInput.subscribe).mockImplementationOnce(() => {
      throw new Error('subscribe failed');
    });

    await expect(
      controller.startRecording({ inputChannel: null, inputId: null, trackId: TRACK_ID })
    ).rejects.toThrowError('subscribe failed');
    expect(controller.getRecordingState().isRecording).toBe(false);
  });

  it('replace 녹음은 새 Region 범위 안의 기존 Note를 제거한다', async () => {
    await controller.addTrack(TRACK_ID);
    controller.setTrackState({ midi: MIDI_STATE, trackId: TRACK_ID });
    audioEngine.setTime(1);
    await controller.startRecording({ inputChannel: null, inputId: null, trackId: TRACK_ID });
    audioEngine.setTime(1.25);
    emitMidiInput({ channel: 1, inputId: 'input-1', note: 65, type: 'noteOn', velocity: 100 });
    monotonicTimeSeconds = 10.25;
    audioEngine.setTime(1.5);
    emitMidiInput({ channel: 1, inputId: 'input-1', note: 65, type: 'noteOff', velocity: 0 });
    audioEngine.setTime(2);

    controller.stopRecording(TRACK_ID);

    const regions = sessionStore.getState().tracks.get(TRACK_ID)?.midi?.regions ?? [];
    expect(regions[0]?.notes).toEqual([]);
    expect(regions[1]?.notes).toMatchObject([{ pitch: 65 }]);
  });
});
