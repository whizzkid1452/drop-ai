export const BUILTIN_MIDI_INSTRUMENT_ID = 'builtin.poly-synth';
export const MIDI_RECORD_MODES = ['replace', 'overdub'] as const;

export type MidiRecordMode = (typeof MIDI_RECORD_MODES)[number];

export interface MidiControlPointState {
  readonly id: string;
  readonly timeOffsetSeconds: number;
  readonly value: number;
}

interface MidiControlLaneBaseState {
  readonly channel: number;
  readonly id: string;
  readonly points: readonly MidiControlPointState[];
}

export interface MidiControlChangeLaneState extends MidiControlLaneBaseState {
  readonly controllerNumber: number;
  readonly type: 'controlChange';
}

export interface MidiPitchBendLaneState extends MidiControlLaneBaseState {
  readonly type: 'pitchBend';
}

export interface MidiChannelPressureLaneState extends MidiControlLaneBaseState {
  readonly type: 'channelPressure';
}

export type MidiControlLaneState = MidiControlChangeLaneState | MidiPitchBendLaneState | MidiChannelPressureLaneState;

export interface MidiNoteState {
  readonly channel: number;
  readonly durationSeconds: number;
  readonly id: string;
  readonly pitch: number;
  readonly startOffsetSeconds: number;
  readonly velocity: number;
}

export interface MidiRegionState {
  readonly controlLanes: readonly MidiControlLaneState[];
  readonly durationSeconds: number;
  readonly id: string;
  readonly name: string;
  readonly notes: readonly MidiNoteState[];
  readonly startTimeSeconds: number;
}

export interface MidiTrackState {
  readonly instrumentId: string;
  readonly recordMode: MidiRecordMode;
  readonly regions: readonly MidiRegionState[];
}

export function cloneMidiTrackState(midi: MidiTrackState) {
  return {
    instrumentId: midi.instrumentId,
    recordMode: midi.recordMode,
    regions: midi.regions.map(region => ({
      ...region,
      controlLanes: region.controlLanes.map(lane => ({
        ...lane,
        points: lane.points.map(point => ({ ...point })),
      })),
      notes: region.notes.map(note => ({ ...note })),
    })),
  };
}
