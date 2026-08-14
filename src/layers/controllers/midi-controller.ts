import type { IAudioEngine, SetMidiTrackStateRequest } from '../audio-engine/i-audio-engine';
import { MidiRecordingRuntime } from '../midi-recording/midi-recording-runtime';
import type { IMidiInput, MidiInputEvent } from '../midi-input/i-midi-input';
import { createDefaultLoopSlots, type SessionStore, type TrackState } from '../session/session';
import { quantizeMidiNotes, transposeMidiNotes } from '../shared/midi-edit';
import type {
  MidiRecordedTake,
  MidiRecordingRuntimeListener,
  MidiRecordingRuntimeState,
} from '../shared/types/midi-recording';
import {
  BUILTIN_MIDI_INSTRUMENT_ID,
  cloneMidiTrackState,
  type MidiRecordMode,
  type MidiTrackState,
} from '../shared/types/midi-state';
import { ProjectMutationCompensationError } from './project-mutation-compensation-error';
import { ProjectStateError, ProjectStateErrorCode } from './project-state-error';

interface MidiControllerDependencies {
  readonly audioEngine: IAudioEngine;
  readonly createId?: () => string;
  readonly midiInput?: IMidiInput;
  readonly nowSeconds?: () => number;
  readonly sessionStore: SessionStore;
}

interface StartMidiTrackRecordingRequest {
  readonly inputChannel: number | null;
  readonly inputId: string | null;
  readonly trackId: string;
}

interface MidiNoteEditRequest {
  readonly noteIds: readonly string[];
  readonly regionId: string;
  readonly trackId: string;
}

interface QuantizeMidiTrackNotesRequest extends MidiNoteEditRequest {
  readonly stepSeconds: number;
}

interface TransposeMidiTrackNotesRequest extends MidiNoteEditRequest {
  readonly semitones: number;
}

export class MidiController {
  private readonly recordingRuntime: MidiRecordingRuntime;
  private unsubscribeMidiInput: (() => void) | null = null;

  constructor(private readonly dependencies: MidiControllerDependencies) {
    this.recordingRuntime = new MidiRecordingRuntime({
      createId: dependencies.createId ?? (() => crypto.randomUUID()),
      nowSeconds: dependencies.nowSeconds ?? (() => performance.now() / 1_000),
    });
  }

  async addTrack(trackId: string): Promise<void> {
    this.assertTrackIdAvailable(trackId);
    await this.dependencies.audioEngine.addMidiTrack(trackId);
    this.assertTrackIdAvailable(trackId);

    try {
      this.dependencies.sessionStore.getState().addTrack(this.createMidiTrack(trackId));
    } catch (cause) {
      try {
        this.dependencies.audioEngine.removeTrack(trackId);
      } catch (compensationCause) {
        throw new ProjectMutationCompensationError({
          cause,
          compensationFailures: [{ cause: compensationCause, step: 'MIDI Track runtime 제거' }],
          failedPhase: 'Session MIDI Track 추가',
          operation: 'MIDI Track 생성',
        });
      }
      throw cause;
    }
  }

  setTrackState(request: SetMidiTrackStateRequest): void {
    const track = this.getMidiTrack(request.trackId);
    const previousMidi = cloneMidiTrackState(track.midi);
    const nextMidi = cloneMidiTrackState(request.midi);

    this.dependencies.audioEngine.setMidiTrackState({ midi: nextMidi, trackId: request.trackId });
    try {
      this.dependencies.sessionStore.getState().updateTrack(request.trackId, { midi: nextMidi });
    } catch (cause) {
      try {
        this.dependencies.audioEngine.setMidiTrackState({ midi: previousMidi, trackId: request.trackId });
      } catch (compensationCause) {
        throw new ProjectMutationCompensationError({
          cause,
          compensationFailures: [{ cause: compensationCause, step: 'MIDI runtime 상태 복원' }],
          failedPhase: 'Session MIDI 상태 저장',
          operation: 'MIDI Track 상태 변경',
        });
      }
      throw cause;
    }
  }

  panic(): void {
    this.dependencies.audioEngine.midiPanic();
  }

  getRecordingState(): MidiRecordingRuntimeState {
    return this.recordingRuntime.getState();
  }

  subscribeRecordingState(listener: MidiRecordingRuntimeListener): () => void {
    return this.recordingRuntime.subscribe(listener);
  }

  async startRecording(request: StartMidiTrackRecordingRequest): Promise<void> {
    this.getMidiTrack(request.trackId);
    const midiInput = this.getMidiInput();
    await midiInput.connect();
    const session = this.dependencies.sessionStore.getState();
    this.recordingRuntime.start({
      ...request,
      loopRange: session.isLoopEnabled ? session.loopRange : null,
      punchRange: session.recording.punch.isEnabled ? session.recording.punch.range : null,
      startedAtSeconds: this.dependencies.audioEngine.getCurrentTime(),
    });
    try {
      this.unsubscribeMidiInput = midiInput.subscribe(event => this.captureInputEvent(request, event));
    } catch (cause) {
      this.recordingRuntime.cancel();
      throw cause;
    }
  }

  stopRecording(trackId: string): MidiRecordedTake {
    this.assertActiveRecordingTrack(trackId);
    this.unsubscribeInput();
    const take = this.recordingRuntime.stop({ stoppedAtSeconds: this.dependencies.audioEngine.getCurrentTime() });
    this.dependencies.audioEngine.midiPanic();
    if (!take.region) {
      return take;
    }
    const track = this.getMidiTrack(trackId);
    this.setTrackState({ midi: this.applyRecordedTake(track.midi, take.region), trackId });
    return take;
  }

  cancelRecording(trackId: string): void {
    this.assertActiveRecordingTrack(trackId);
    this.unsubscribeInput();
    this.recordingRuntime.cancel();
    this.dependencies.audioEngine.midiPanic();
  }

  setRecordMode(trackId: string, recordMode: MidiRecordMode): void {
    const track = this.getMidiTrack(trackId);
    this.setTrackState({ midi: { ...cloneMidiTrackState(track.midi), recordMode }, trackId });
  }

  quantizeNotes(request: QuantizeMidiTrackNotesRequest): void {
    const track = this.getMidiTrack(request.trackId);
    this.setTrackState({ midi: quantizeMidiNotes({ ...request, midi: track.midi }), trackId: request.trackId });
  }

  transposeNotes(request: TransposeMidiTrackNotesRequest): void {
    const track = this.getMidiTrack(request.trackId);
    this.setTrackState({ midi: transposeMidiNotes({ ...request, midi: track.midi }), trackId: request.trackId });
  }

  private captureInputEvent(request: StartMidiTrackRecordingRequest, event: MidiInputEvent): void {
    if (!this.matchesInputRoute(request, event)) {
      return;
    }
    this.recordingRuntime.capture({
      event,
      transportTimeSeconds: this.dependencies.audioEngine.getCurrentTime(),
    });
    this.dependencies.audioEngine.sendMidiInputEvent({ event, trackId: request.trackId });
  }

  private applyRecordedTake(midi: MidiTrackState, region: NonNullable<MidiRecordedTake['region']>) {
    const existingRegions =
      midi.recordMode === 'overdub'
        ? midi.regions
        : midi.regions.map(existingRegion => ({
            ...existingRegion,
            controlLanes: existingRegion.controlLanes.map(lane => ({
              ...lane,
              points: lane.points.filter(point => {
                const absoluteTimeSeconds = existingRegion.startTimeSeconds + point.timeOffsetSeconds;
                return !this.isInsideRegion(absoluteTimeSeconds, region);
              }),
            })),
            notes: existingRegion.notes.filter(note => {
              const absoluteTimeSeconds = existingRegion.startTimeSeconds + note.startOffsetSeconds;
              return !this.isInsideRegion(absoluteTimeSeconds, region);
            }),
          }));
    return { ...cloneMidiTrackState(midi), regions: [...existingRegions, region] };
  }

  private isInsideRegion(timeSeconds: number, region: NonNullable<MidiRecordedTake['region']>): boolean {
    return timeSeconds >= region.startTimeSeconds && timeSeconds < region.startTimeSeconds + region.durationSeconds;
  }

  private matchesInputRoute(request: StartMidiTrackRecordingRequest, event: MidiInputEvent): boolean {
    return (
      (request.inputId === null || request.inputId === event.inputId) &&
      (request.inputChannel === null || request.inputChannel === event.channel)
    );
  }

  private assertActiveRecordingTrack(trackId: string): void {
    const state = this.recordingRuntime.getState();
    if (!state.isRecording || state.trackId !== trackId) {
      throw new Error(`진행 중인 MIDI 녹음 Track이 아닙니다: ${trackId}`);
    }
  }

  private unsubscribeInput(): void {
    this.unsubscribeMidiInput?.();
    this.unsubscribeMidiInput = null;
  }

  private getMidiInput(): IMidiInput {
    if (!this.dependencies.midiInput) {
      throw new Error('MIDI 입력 runtime이 구성되지 않았습니다.');
    }
    return this.dependencies.midiInput;
  }

  private createMidiTrack(trackId: string): TrackState {
    return {
      id: trackId,
      isMuted: false,
      isSoloed: false,
      loopSlots: createDefaultLoopSlots(),
      midi: { instrumentId: BUILTIN_MIDI_INSTRUMENT_ID, recordMode: 'replace', regions: [] },
      name: `MIDI Track ${trackId}`,
      pan: 0,
      pluginInstances: [],
      regions: [],
      status: [],
      volume: 1,
    };
  }

  private getMidiTrack(trackId: string): TrackState & { readonly midi: NonNullable<TrackState['midi']> } {
    const track = this.dependencies.sessionStore.getState().tracks.get(trackId);
    if (!track) {
      throw new ProjectStateError(ProjectStateErrorCode.TRACK_NOT_FOUND, `Track을 찾을 수 없습니다: ${trackId}`, {
        trackId,
      });
    }
    if (!track.midi) {
      throw new ProjectStateError(ProjectStateErrorCode.TRACK_NOT_MIDI, `MIDI Track이 아닙니다: ${trackId}`, {
        trackId,
      });
    }
    return track as TrackState & { readonly midi: NonNullable<TrackState['midi']> };
  }

  private assertTrackIdAvailable(trackId: string): void {
    if (!this.dependencies.sessionStore.getState().tracks.has(trackId)) {
      return;
    }
    throw new ProjectStateError(ProjectStateErrorCode.TRACK_ID_CONFLICT, `이미 사용 중인 Track ID입니다: ${trackId}`, {
      trackId,
    });
  }
}
