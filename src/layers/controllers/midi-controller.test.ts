import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
import { createSessionStore, type SessionStore } from '../session/session';
import { BUILTIN_MIDI_INSTRUMENT_ID, type MidiTrackState } from '../shared/types/midi-state';
import { MidiController } from './midi-controller';
import { ProjectMutationCompensationError } from './project-mutation-compensation-error';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const REGION_ID = '22222222-2222-4222-8222-222222222222';
const NOTE_ID = '33333333-3333-4333-8333-333333333333';

const MIDI_STATE: MidiTrackState = {
  instrumentId: BUILTIN_MIDI_INSTRUMENT_ID,
  regions: [
    {
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
  let sessionStore: SessionStore;
  let controller: MidiController;

  beforeEach(() => {
    audioEngine = new MockAudioEngine();
    sessionStore = createSessionStore({
      initialProjectMetadata: {
        id: '44444444-4444-4444-8444-444444444444',
        name: 'MIDI test',
        revision: 0,
      },
    });
    controller = new MidiController({ audioEngine, sessionStore });
  });

  it('runtime 생성 뒤 빈 MIDI Track을 Session에 추가한다', async () => {
    await controller.addTrack(TRACK_ID);

    expect(audioEngine.getMockMidiTrackState(TRACK_ID)).toEqual({
      instrumentId: BUILTIN_MIDI_INSTRUMENT_ID,
      regions: [],
    });
    expect(sessionStore.getState().tracks.get(TRACK_ID)?.midi).toEqual({
      instrumentId: BUILTIN_MIDI_INSTRUMENT_ID,
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
      midi: { instrumentId: BUILTIN_MIDI_INSTRUMENT_ID, regions: [] },
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
});
