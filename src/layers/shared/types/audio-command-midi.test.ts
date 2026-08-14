import { describe, expect, it } from 'vitest';
import { AudioCommandSchema, AudioCommandType, StrictAudioCommandSchema } from './audioCommand.schema';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const REGION_ID = '22222222-2222-4222-8222-222222222222';
const NOTE_ID = '33333333-3333-4333-8333-333333333333';

describe('MIDI 명령 계약', () => {
  it('MIDI Track 생성 명령을 허용한다', () => {
    const command = { trackId: TRACK_ID, type: AudioCommandType.ADD_MIDI_TRACK };

    expect(AudioCommandSchema.parse(command)).toEqual(command);
    expect(StrictAudioCommandSchema.parse(command)).toEqual(command);
  });

  it('검증된 MIDI Track 상태만 허용한다', () => {
    const command = {
      midi: {
        instrumentId: 'builtin.poly-synth',
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
      },
      trackId: TRACK_ID,
      type: AudioCommandType.SET_MIDI_TRACK_STATE,
    };

    expect(StrictAudioCommandSchema.parse(command)).toEqual(command);
    expect(
      StrictAudioCommandSchema.safeParse({
        ...command,
        midi: {
          ...command.midi,
          regions: [
            {
              ...command.midi.regions[0],
              notes: [{ ...command.midi.regions[0].notes[0], pitch: 128 }],
            },
          ],
        },
      }).success
    ).toBe(false);
  });

  it('MIDI panic 명령은 추가 인자를 받지 않는다', () => {
    expect(StrictAudioCommandSchema.parse({ type: AudioCommandType.MIDI_PANIC })).toEqual({
      type: AudioCommandType.MIDI_PANIC,
    });
    expect(StrictAudioCommandSchema.safeParse({ type: AudioCommandType.MIDI_PANIC, trackId: TRACK_ID }).success).toBe(
      false
    );
  });

  it('MIDI 녹음 시작 명령의 입력 route를 검증한다', () => {
    const command = {
      inputChannel: 16,
      inputId: 'keyboard-1',
      trackId: TRACK_ID,
      type: AudioCommandType.START_MIDI_RECORDING,
    };

    expect(StrictAudioCommandSchema.parse(command)).toEqual(command);
    expect(StrictAudioCommandSchema.safeParse({ ...command, inputChannel: 17 }).success).toBe(false);
    expect(StrictAudioCommandSchema.safeParse({ ...command, inputId: ' ' }).success).toBe(false);
  });

  it('MIDI 녹음 모드와 종료 명령을 검증한다', () => {
    expect(
      StrictAudioCommandSchema.parse({
        recordMode: 'overdub',
        trackId: TRACK_ID,
        type: AudioCommandType.SET_MIDI_RECORD_MODE,
      })
    ).toMatchObject({ recordMode: 'overdub' });
    expect(
      StrictAudioCommandSchema.parse({ trackId: TRACK_ID, type: AudioCommandType.STOP_MIDI_RECORDING })
    ).toMatchObject({ trackId: TRACK_ID });
    expect(
      StrictAudioCommandSchema.parse({ trackId: TRACK_ID, type: AudioCommandType.CANCEL_MIDI_RECORDING })
    ).toMatchObject({ trackId: TRACK_ID });
  });

  it('Quantize 간격과 Transpose 범위를 검증한다', () => {
    const quantize = {
      noteIds: [NOTE_ID],
      regionId: REGION_ID,
      stepSeconds: 0.25,
      trackId: TRACK_ID,
      type: AudioCommandType.QUANTIZE_MIDI_NOTES,
    };
    const transpose = {
      noteIds: [NOTE_ID],
      regionId: REGION_ID,
      semitones: -12,
      trackId: TRACK_ID,
      type: AudioCommandType.TRANSPOSE_MIDI_NOTES,
    };

    expect(StrictAudioCommandSchema.parse(quantize)).toEqual(quantize);
    expect(StrictAudioCommandSchema.parse(transpose)).toEqual(transpose);
    expect(StrictAudioCommandSchema.safeParse({ ...quantize, stepSeconds: 0 }).success).toBe(false);
    expect(StrictAudioCommandSchema.safeParse({ ...transpose, semitones: 128 }).success).toBe(false);
  });
});
