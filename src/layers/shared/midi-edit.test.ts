import { describe, expect, it } from 'vitest';
import type { MidiTrackState } from './types/midi-state';
import { quantizeMidiNotes, transposeMidiNotes } from './midi-edit';

const REGION_ID = '11111111-1111-4111-8111-111111111111';
const FIRST_NOTE_ID = '22222222-2222-4222-8222-222222222222';
const SECOND_NOTE_ID = '33333333-3333-4333-8333-333333333333';

function createMidi(): MidiTrackState {
  return {
    instrumentId: 'builtin.poly-synth',
    recordMode: 'replace',
    regions: [
      {
        controlLanes: [],
        durationSeconds: 2,
        id: REGION_ID,
        name: 'Edit',
        notes: [
          {
            channel: 1,
            durationSeconds: 0.5,
            id: FIRST_NOTE_ID,
            pitch: 60,
            startOffsetSeconds: 0.37,
            velocity: 100,
          },
          {
            channel: 1,
            durationSeconds: 0.5,
            id: SECOND_NOTE_ID,
            pitch: 127,
            startOffsetSeconds: 1.4,
            velocity: 90,
          },
        ],
        startTimeSeconds: 0,
      },
    ],
  };
}

describe('MIDI note 편집', () => {
  it('선택 Note 시작점을 grid에 맞추고 입력 상태를 변경하지 않는다', () => {
    const midi = createMidi();

    const result = quantizeMidiNotes({
      midi,
      noteIds: [FIRST_NOTE_ID],
      regionId: REGION_ID,
      stepSeconds: 0.25,
    });

    expect(result.regions[0]?.notes).toMatchObject([
      { id: FIRST_NOTE_ID, startOffsetSeconds: 0.25 },
      { id: SECOND_NOTE_ID, startOffsetSeconds: 1.4 },
    ]);
    expect(midi.regions[0]?.notes[0]?.startOffsetSeconds).toBe(0.37);
  });

  it('Region 끝을 넘는 quantize 결과를 Note 길이만큼 앞에서 제한한다', () => {
    const midi = createMidi();
    const secondNote = midi.regions[0]?.notes[1];
    const firstNote = midi.regions[0]?.notes[0];
    const region = midi.regions[0];
    if (!firstNote || !secondNote || !region) {
      throw new Error('검증할 MIDI Note가 없습니다.');
    }
    const midiNearRegionEnd: MidiTrackState = {
      ...midi,
      regions: [
        {
          ...region,
          notes: [firstNote, { ...secondNote, startOffsetSeconds: 1.6 }],
        },
      ],
    };

    const result = quantizeMidiNotes({
      midi: midiNearRegionEnd,
      noteIds: [SECOND_NOTE_ID],
      regionId: REGION_ID,
      stepSeconds: 1,
    });

    expect(result.regions[0]?.notes[1]?.startOffsetSeconds).toBe(1.5);
  });

  it('선택 Note만 반음 단위로 이동한다', () => {
    const result = transposeMidiNotes({
      midi: createMidi(),
      noteIds: [FIRST_NOTE_ID],
      regionId: REGION_ID,
      semitones: -12,
    });

    expect(result.regions[0]?.notes).toMatchObject([
      { id: FIRST_NOTE_ID, pitch: 48 },
      { id: SECOND_NOTE_ID, pitch: 127 },
    ]);
  });

  it('하나라도 MIDI pitch 범위를 벗어나면 전체 transpose를 거부한다', () => {
    const midi = createMidi();

    expect(() =>
      transposeMidiNotes({ midi, noteIds: [FIRST_NOTE_ID, SECOND_NOTE_ID], regionId: REGION_ID, semitones: 1 })
    ).toThrowError('MIDI pitch 범위');
    expect(midi.regions[0]?.notes[0]?.pitch).toBe(60);
  });
});
