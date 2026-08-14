import type { IAudioEngine, SetMidiTrackStateRequest } from '../audio-engine/i-audio-engine';
import { createDefaultLoopSlots, type SessionStore, type TrackState } from '../session/session';
import { BUILTIN_MIDI_INSTRUMENT_ID, cloneMidiTrackState } from '../shared/types/midi-state';
import { ProjectMutationCompensationError } from './project-mutation-compensation-error';
import { ProjectStateError, ProjectStateErrorCode } from './project-state-error';

interface MidiControllerDependencies {
  readonly audioEngine: IAudioEngine;
  readonly sessionStore: SessionStore;
}

export class MidiController {
  constructor(private readonly dependencies: MidiControllerDependencies) {}

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
