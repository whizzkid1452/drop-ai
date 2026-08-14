export const BUILTIN_MIDI_INSTRUMENT_ID = 'builtin.poly-synth';

export interface MidiNoteState {
  readonly channel: number;
  readonly durationSeconds: number;
  readonly id: string;
  readonly pitch: number;
  readonly startOffsetSeconds: number;
  readonly velocity: number;
}

export interface MidiRegionState {
  readonly durationSeconds: number;
  readonly id: string;
  readonly name: string;
  readonly notes: readonly MidiNoteState[];
  readonly startTimeSeconds: number;
}

export interface MidiTrackState {
  readonly instrumentId: string;
  readonly regions: readonly MidiRegionState[];
}

export function cloneMidiTrackState(midi: MidiTrackState): MidiTrackState {
  return {
    instrumentId: midi.instrumentId,
    regions: midi.regions.map(region => ({
      ...region,
      notes: region.notes.map(note => ({ ...note })),
    })),
  };
}
