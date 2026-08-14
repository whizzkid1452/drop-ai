export interface MidiInputDevice {
  readonly id: string;
  readonly manufacturer: string | null;
  readonly name: string | null;
  readonly state: MIDIPortDeviceState;
}

export interface MidiNoteOnEvent {
  readonly channel: number;
  readonly inputId: string;
  readonly note: number;
  readonly type: 'noteOn';
  readonly velocity: number;
}

export interface MidiNoteOffEvent {
  readonly channel: number;
  readonly inputId: string;
  readonly note: number;
  readonly type: 'noteOff';
  readonly velocity: number;
}

export interface MidiControlChangeEvent {
  readonly channel: number;
  readonly controllerNumber: number;
  readonly inputId: string;
  readonly type: 'controlChange';
  readonly value: number;
}

export interface MidiPitchBendEvent {
  readonly channel: number;
  readonly inputId: string;
  readonly type: 'pitchBend';
  readonly value: number;
}

export interface MidiChannelPressureEvent {
  readonly channel: number;
  readonly inputId: string;
  readonly type: 'channelPressure';
  readonly value: number;
}

export type MidiInputEvent =
  | MidiNoteOnEvent
  | MidiNoteOffEvent
  | MidiControlChangeEvent
  | MidiPitchBendEvent
  | MidiChannelPressureEvent;

export type MidiInputListener = (event: MidiInputEvent) => void;

export interface IMidiInput {
  connect(): Promise<readonly MidiInputDevice[]>;
  disconnect(): void;
  subscribe(listener: MidiInputListener): () => void;
}
