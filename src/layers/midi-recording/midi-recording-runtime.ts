import type { MidiInputEvent } from '../midi-input/i-midi-input';
import type {
  MidiRecordedTake,
  MidiRecordingRuntimeListener,
  MidiRecordingRuntimeState,
  StartMidiRecordingRequest,
} from '../shared/types/midi-recording';
import type { MidiControlLaneState, MidiNoteState, MidiRegionState } from '../shared/types/midi-state';

const MINIMUM_EVENT_DURATION_SECONDS = 0.001;

interface MidiRecordingRuntimeOptions {
  readonly createId: () => string;
  readonly nowSeconds: () => number;
}

interface CaptureMidiEventRequest {
  readonly event: MidiInputEvent;
  readonly transportTimeSeconds: number;
}

interface StopMidiRecordingRequest {
  readonly stoppedAtSeconds: number;
}

interface ActiveNote {
  readonly channel: number;
  readonly id: string;
  readonly pitch: number;
  readonly startedAtMonotonicSeconds: number;
  readonly startOffsetSeconds: number;
  readonly velocity: number;
}

interface CapturedControlEvent {
  readonly event: Exclude<MidiInputEvent, { readonly type: 'noteOn' | 'noteOff' }>;
  readonly id: string;
  readonly timeOffsetSeconds: number;
}

interface ActiveRecording {
  readonly activeNotes: Map<string, ActiveNote>;
  readonly completedNotes: MidiNoteState[];
  readonly controlEvents: CapturedControlEvent[];
  readonly request: StartMidiRecordingRequest;
  capturedEventCount: number;
}

const IDLE_STATE: MidiRecordingRuntimeState = {
  capturedEventCount: 0,
  inputChannel: null,
  inputId: null,
  isRecording: false,
  trackId: null,
};

export class MidiRecordingRuntime {
  private readonly listeners = new Set<MidiRecordingRuntimeListener>();
  private activeRecording: ActiveRecording | null = null;

  constructor(private readonly options: MidiRecordingRuntimeOptions) {}

  getState(): MidiRecordingRuntimeState {
    const active = this.activeRecording;
    return active
      ? {
          capturedEventCount: active.capturedEventCount,
          inputChannel: active.request.inputChannel,
          inputId: active.request.inputId,
          isRecording: true,
          trackId: active.request.trackId,
        }
      : IDLE_STATE;
  }

  subscribe(listener: MidiRecordingRuntimeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(request: StartMidiRecordingRequest): void {
    if (this.activeRecording) {
      throw new Error('이미 MIDI 녹음이 진행 중입니다.');
    }
    this.activeRecording = {
      activeNotes: new Map(),
      capturedEventCount: 0,
      completedNotes: [],
      controlEvents: [],
      request,
    };
    this.emitState();
  }

  capture({ event, transportTimeSeconds }: CaptureMidiEventRequest): void {
    const active = this.activeRecording;
    if (
      !active ||
      !this.matchesInputRoute(active.request, event) ||
      !this.isInsideRecordingRange(active.request, transportTimeSeconds)
    ) {
      return;
    }
    const timeOffsetSeconds = this.toRegionOffset(active.request, transportTimeSeconds);
    const regionDurationSeconds = this.getCaptureRegionDuration(active.request);
    if (timeOffsetSeconds < 0 || timeOffsetSeconds >= regionDurationSeconds) {
      return;
    }

    active.capturedEventCount += 1;
    if (event.type === 'noteOn') {
      this.captureNoteOn(active, event, timeOffsetSeconds, regionDurationSeconds);
    } else if (event.type === 'noteOff') {
      this.captureNoteOff(active, event, regionDurationSeconds);
    } else {
      active.controlEvents.push({ event, id: this.options.createId(), timeOffsetSeconds });
    }
    this.emitState();
  }

  stop({ stoppedAtSeconds }: StopMidiRecordingRequest): MidiRecordedTake {
    const active = this.activeRecording;
    if (!active) {
      throw new Error('진행 중인 MIDI 녹음이 없습니다.');
    }
    const regionStartTimeSeconds = this.getRegionStart(active.request);
    const regionDurationSeconds = this.getRegionDuration(active.request, stoppedAtSeconds);
    active.activeNotes.forEach(note => this.completeNote(active, note, regionDurationSeconds));
    const region = this.createRegion(active, regionStartTimeSeconds, regionDurationSeconds);
    this.activeRecording = null;
    this.emitState();
    return { capturedEventCount: active.capturedEventCount, region, trackId: active.request.trackId };
  }

  cancel(): void {
    if (!this.activeRecording) {
      return;
    }
    this.activeRecording = null;
    this.emitState();
  }

  private captureNoteOn(
    active: ActiveRecording,
    event: Extract<MidiInputEvent, { readonly type: 'noteOn' }>,
    timeOffsetSeconds: number,
    regionDurationSeconds: number
  ): void {
    const key = this.createNoteKey(event);
    const previousNote = active.activeNotes.get(key);
    if (previousNote) {
      this.completeNote(active, previousNote, regionDurationSeconds);
    }
    active.activeNotes.set(key, {
      channel: event.channel,
      id: this.options.createId(),
      pitch: event.note,
      startedAtMonotonicSeconds: this.options.nowSeconds(),
      startOffsetSeconds: timeOffsetSeconds,
      velocity: event.velocity,
    });
  }

  private captureNoteOff(
    active: ActiveRecording,
    event: Extract<MidiInputEvent, { readonly type: 'noteOff' }>,
    regionDurationSeconds: number
  ): void {
    const key = this.createNoteKey(event);
    const note = active.activeNotes.get(key);
    if (!note) {
      return;
    }
    this.completeNote(active, note, regionDurationSeconds);
    active.activeNotes.delete(key);
  }

  private completeNote(active: ActiveRecording, note: ActiveNote, regionDurationSeconds: number): void {
    const remainingDurationSeconds = regionDurationSeconds - note.startOffsetSeconds;
    if (remainingDurationSeconds < MINIMUM_EVENT_DURATION_SECONDS) {
      return;
    }
    const elapsedSeconds = this.options.nowSeconds() - note.startedAtMonotonicSeconds;
    active.completedNotes.push({
      channel: note.channel,
      durationSeconds: Math.min(remainingDurationSeconds, Math.max(MINIMUM_EVENT_DURATION_SECONDS, elapsedSeconds)),
      id: note.id,
      pitch: note.pitch,
      startOffsetSeconds: note.startOffsetSeconds,
      velocity: note.velocity,
    });
  }

  private createRegion(
    active: ActiveRecording,
    startTimeSeconds: number,
    durationSeconds: number
  ): MidiRegionState | null {
    const controlLanes = this.createControlLanes(active.controlEvents);
    if (active.completedNotes.length === 0 && controlLanes.length === 0) {
      return null;
    }
    return {
      controlLanes,
      durationSeconds,
      id: this.options.createId(),
      name: 'MIDI Take',
      notes: active.completedNotes.sort((left, right) => left.startOffsetSeconds - right.startOffsetSeconds),
      startTimeSeconds,
    };
  }

  private createControlLanes(events: readonly CapturedControlEvent[]): MidiControlLaneState[] {
    const groups = new Map<string, CapturedControlEvent[]>();
    events.forEach(event => {
      const controllerNumber = event.event.type === 'controlChange' ? event.event.controllerNumber : '';
      const key = `${event.event.type}:${event.event.channel}:${controllerNumber}`;
      groups.set(key, [...(groups.get(key) ?? []), event]);
    });
    return [...groups.values()].map(group => {
      const first = group[0];
      if (!first) {
        throw new Error('MIDI 제어 event group이 비어 있습니다.');
      }
      const points = group.map(entry => ({
        id: entry.id,
        timeOffsetSeconds: entry.timeOffsetSeconds,
        value: entry.event.value,
      }));
      if (first.event.type === 'controlChange') {
        return {
          channel: first.event.channel,
          controllerNumber: first.event.controllerNumber,
          id: this.options.createId(),
          points,
          type: first.event.type,
        };
      }
      return {
        channel: first.event.channel,
        id: this.options.createId(),
        points,
        type: first.event.type,
      };
    });
  }

  private matchesInputRoute(request: StartMidiRecordingRequest, event: MidiInputEvent): boolean {
    return (
      (request.inputId === null || request.inputId === event.inputId) &&
      (request.inputChannel === null || request.inputChannel === event.channel)
    );
  }

  private isInsideRecordingRange(request: StartMidiRecordingRequest, timeSeconds: number): boolean {
    if (request.punchRange) {
      return timeSeconds >= request.punchRange.startTimeSeconds && timeSeconds < request.punchRange.endTimeSeconds;
    }
    return request.loopRange !== null || timeSeconds >= request.startedAtSeconds;
  }

  private getRegionStart(request: StartMidiRecordingRequest): number {
    return request.punchRange?.startTimeSeconds ?? request.loopRange?.startTimeSeconds ?? request.startedAtSeconds;
  }

  private getRegionDuration(request: StartMidiRecordingRequest, endTimeSeconds: number): number {
    const fixedRange = request.punchRange ?? request.loopRange;
    return fixedRange
      ? fixedRange.endTimeSeconds - fixedRange.startTimeSeconds
      : Math.max(MINIMUM_EVENT_DURATION_SECONDS, endTimeSeconds - request.startedAtSeconds);
  }

  private getCaptureRegionDuration(request: StartMidiRecordingRequest): number {
    const fixedRange = request.punchRange ?? request.loopRange;
    return fixedRange ? fixedRange.endTimeSeconds - fixedRange.startTimeSeconds : Number.POSITIVE_INFINITY;
  }

  private toRegionOffset(request: StartMidiRecordingRequest, timeSeconds: number): number {
    if (request.punchRange) {
      return timeSeconds - request.punchRange.startTimeSeconds;
    }
    if (request.loopRange) {
      const durationSeconds = request.loopRange.endTimeSeconds - request.loopRange.startTimeSeconds;
      return (
        (((timeSeconds - request.loopRange.startTimeSeconds) % durationSeconds) + durationSeconds) % durationSeconds
      );
    }
    return timeSeconds - this.getRegionStart(request);
  }

  private createNoteKey(event: { readonly channel: number; readonly inputId: string; readonly note: number }): string {
    return `${event.inputId}:${event.channel}:${event.note}`;
  }

  private emitState(): void {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }
}
