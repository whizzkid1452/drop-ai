import { describe, expect, it } from 'vitest';
import { BUILTIN_MIDI_INSTRUMENT_ID, type MidiTrackState } from '../shared/types/midi-state';
import { parseStandardMidiFile, writeStandardMidiFile } from './midi-file-codec';

const midi: MidiTrackState = {
  instrumentId: BUILTIN_MIDI_INSTRUMENT_ID,
  regions: [
    {
      durationSeconds: 2,
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Verse',
      notes: [
        {
          channel: 1,
          durationSeconds: 0.5,
          id: '22222222-2222-4222-8222-222222222222',
          pitch: 60,
          startOffsetSeconds: 0.5,
          velocity: 96,
        },
        {
          channel: 2,
          durationSeconds: 0.25,
          id: '33333333-3333-4333-8333-333333333333',
          pitch: 64,
          startOffsetSeconds: 1.25,
          velocity: 80,
        },
      ],
      startTimeSeconds: 1,
    },
  ],
};

describe('MIDI file codec', () => {
  it('SMF export와 import round trip에서 note와 timing을 유지한다', () => {
    const data = writeStandardMidiFile({ tempoBpm: 120, tracks: [{ midi, name: '건반' }] });
    const header = new TextDecoder().decode(new Uint8Array(data, 0, 4));
    const imported = parseStandardMidiFile({
      createId: () => crypto.randomUUID(),
      data,
    });

    expect(header).toBe('MThd');
    expect(imported.tempoBpm).toBeCloseTo(120, 4);
    expect(imported.tracks).toHaveLength(1);
    expect(imported.tracks[0]?.name).toBe('건반');
    expect(imported.tracks[0]?.midi.instrumentId).toBe(BUILTIN_MIDI_INSTRUMENT_ID);
    expect(imported.tracks[0]?.midi.regions[0]?.notes).toMatchObject([
      { channel: 1, durationSeconds: 0.5, pitch: 60, startOffsetSeconds: 1.5, velocity: 96 },
      { channel: 2, durationSeconds: 0.25, pitch: 64, startOffsetSeconds: 2.25, velocity: 80 },
    ]);
  });

  it('SMF가 아니면 명시적인 오류를 반환한다', () => {
    expect(() =>
      parseStandardMidiFile({
        createId: () => crypto.randomUUID(),
        data: new TextEncoder().encode('not-midi').buffer,
      })
    ).toThrow('유효한 MIDI 파일이 아닙니다');
  });
});
