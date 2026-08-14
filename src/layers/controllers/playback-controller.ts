import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import { type SessionStore } from '../session/session';
import type { TimelineRange } from '../shared/types/project-document.schema';
import {
  TimelineCoordinateMapper,
  type TimelineMeterChange,
  type TimelineTempoChange,
} from '../shared/timeline-coordinate-mapper';
import {
  ProjectMutationCompensationError,
  type ProjectMutationCompensationFailure,
} from './project-mutation-compensation-error';

interface SetTimelineMapRequest {
  readonly tempoChanges: readonly TimelineTempoChange[];
  readonly meterChanges: readonly TimelineMeterChange[];
}

export class PlaybackController {
  constructor(
    private sessionStore: SessionStore,
    private audioEngine: IAudioEngine
  ) {}

  async handlePlay(): Promise<void> {
    console.log('[PlaybackController] Handling Play Request');

    // 1. Command Audio Engine
    await this.audioEngine.play();

    // 2. Update Session State via Zustand Actions
    this.sessionStore.getState().setPlaying(true);
  }

  async resumeAudioRuntime(): Promise<void> {
    await this.audioEngine.resumeRuntime();
  }

  handleStop(): void {
    console.log('[PlaybackController] Handling Stop Request');

    // 1. Command Audio Engine
    this.audioEngine.stop();

    // 2. Update Session State
    this.sessionStore.getState().stopPlayback();
  }

  handlePause(): void {
    console.log('[PlaybackController] Handling Pause Request');

    // 1. Command Audio Engine
    this.audioEngine.pause();
    const currentTime = this.audioEngine.getCurrentTime();

    // 2. Update Session State
    this.sessionStore.getState().pausePlayback(currentTime);
  }

  handleSeek(time: number): void {
    console.log(`[PlaybackController] Seeking to ${time}`);

    // Command Audio Engine
    this.audioEngine.setTime(time);

    // Update Session State
    this.sessionStore.getState().setCurrentTime(time);
  }

  handleSetTempo(tempo: number): void {
    console.log(`[PlaybackController] Setting tempo to ${tempo}`);

    const tempoChanges = this.sessionStore
      .getState()
      .tempoChanges.map((change, index) => (index === 0 ? { ...change, bpm: tempo } : change));
    this.audioEngine.setTempoMap({ changes: tempoChanges });
    this.sessionStore.getState().setTempo(tempo);
  }

  handleSetTimelineMap({ tempoChanges, meterChanges }: SetTimelineMapRequest): void {
    const initialTempo = tempoChanges[0];
    const initialMeter = meterChanges[0];
    if (!initialTempo || !initialMeter) {
      throw new Error('Tempo·Meter Map에는 0 위치 marker가 필요합니다.');
    }

    // Session을 바꾸기 전에 전체 Map을 검증해 Tempo와 Meter가 부분 반영되지 않게 합니다.
    new TimelineCoordinateMapper({
      tempoBpm: initialTempo.bpm,
      beatsPerBar: initialMeter.beatsPerBar,
      beatUnit: initialMeter.beatUnit,
      tempoChanges,
      meterChanges,
    });
    this.audioEngine.setTempoMap({ changes: tempoChanges });
    this.sessionStore.getState().setTimelineMap({ tempoChanges, meterChanges });
  }

  handleSetLoopRange(range: TimelineRange | null, isEnabled?: boolean): void {
    const sessionState = this.sessionStore.getState();
    const previousRange = sessionState.loopRange;
    const previousIsEnabled = sessionState.isLoopEnabled;
    const nextIsEnabled = range !== null && (isEnabled ?? previousIsEnabled);

    try {
      this.audioEngine.setLoopRange(range);
      this.audioEngine.setLoopEnabled(nextIsEnabled);
    } catch (cause) {
      this.restoreLoopRuntime({ range: previousRange, isEnabled: previousIsEnabled, cause });
    }

    this.sessionStore.getState().setLoopState({ range, isEnabled: nextIsEnabled });
  }

  handleSetLoopEnabled(isEnabled: boolean): void {
    if (isEnabled && this.sessionStore.getState().loopRange === null) {
      throw new RangeError('Loop를 활성화하려면 범위를 먼저 설정해야 합니다.');
    }
    this.audioEngine.setLoopEnabled(isEnabled);
    this.sessionStore.getState().setLoopEnabled(isEnabled);
  }

  handleSetMetronome({ isEnabled, volume }: { readonly isEnabled: boolean; readonly volume: number }): void {
    const sessionState = this.sessionStore.getState();

    try {
      this.audioEngine.setMetronomeVolume(volume);
      this.audioEngine.setMetronomeEnabled(isEnabled);
    } catch (cause) {
      this.restoreMetronomeRuntime({
        isEnabled: sessionState.isMetronomeEnabled,
        volume: sessionState.metronomeVolume,
        cause,
      });
    }

    this.sessionStore.getState().setMetronomeState({ isEnabled, volume });
  }

  getCurrentTime(): number {
    return this.audioEngine.getCurrentTime();
  }

  private restoreLoopRuntime({
    range,
    isEnabled,
    cause,
  }: {
    readonly range: TimelineRange | null;
    readonly isEnabled: boolean;
    readonly cause: unknown;
  }): never {
    const compensationFailures: ProjectMutationCompensationFailure[] = [];
    this.tryRuntimeCompensation(() => this.audioEngine.setLoopRange(range), 'Loop 범위 복원', compensationFailures);
    this.tryRuntimeCompensation(
      () => this.audioEngine.setLoopEnabled(isEnabled),
      'Loop 활성 상태 복원',
      compensationFailures
    );
    this.throwRuntimeFailure({ operation: 'Loop 상태 변경', cause, compensationFailures });
  }

  private restoreMetronomeRuntime({
    isEnabled,
    volume,
    cause,
  }: {
    readonly isEnabled: boolean;
    readonly volume: number;
    readonly cause: unknown;
  }): never {
    const compensationFailures: ProjectMutationCompensationFailure[] = [];
    this.tryRuntimeCompensation(
      () => this.audioEngine.setMetronomeVolume(volume),
      'Metronome 볼륨 복원',
      compensationFailures
    );
    this.tryRuntimeCompensation(
      () => this.audioEngine.setMetronomeEnabled(isEnabled),
      'Metronome 활성 상태 복원',
      compensationFailures
    );
    this.throwRuntimeFailure({ operation: 'Metronome 상태 변경', cause, compensationFailures });
  }

  private tryRuntimeCompensation(
    operation: () => void,
    step: string,
    compensationFailures: ProjectMutationCompensationFailure[]
  ): void {
    try {
      operation();
    } catch (cause) {
      compensationFailures.push({ step, cause });
    }
  }

  private throwRuntimeFailure({
    operation,
    cause,
    compensationFailures,
  }: {
    readonly operation: string;
    readonly cause: unknown;
    readonly compensationFailures: readonly ProjectMutationCompensationFailure[];
  }): never {
    if (compensationFailures.length === 0) {
      throw cause;
    }

    throw new ProjectMutationCompensationError({
      operation,
      failedPhase: 'AudioEngine runtime 상태',
      cause,
      compensationFailures,
    });
  }
}
