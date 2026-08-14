import type { MidiRegionState } from './midi-state';
import type { TimelineRange } from './project-document.schema';

export interface MidiRecordingRuntimeState {
  readonly capturedEventCount: number;
  readonly inputChannel: number | null;
  readonly inputId: string | null;
  readonly isRecording: boolean;
  readonly trackId: string | null;
}

export interface StartMidiRecordingRequest {
  readonly inputChannel: number | null;
  readonly inputId: string | null;
  readonly loopRange: TimelineRange | null;
  readonly punchRange: TimelineRange | null;
  readonly startedAtSeconds: number;
  readonly trackId: string;
}

export interface MidiRecordedTake {
  readonly capturedEventCount: number;
  readonly region: MidiRegionState | null;
  readonly trackId: string;
}

export type MidiRecordingRuntimeListener = (state: MidiRecordingRuntimeState) => void;
