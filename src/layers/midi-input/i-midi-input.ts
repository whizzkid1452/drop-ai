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
  readonly velocity: number;
}

export type MidiNoteOnListener = (event: MidiNoteOnEvent) => void;

export interface IMidiInput {
  connect(): Promise<readonly MidiInputDevice[]>;
  disconnect(): void;
  subscribe(listener: MidiNoteOnListener): () => void;
}
