import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import type { IAudioSourceRegistry } from '../audio-source-registry/i-audio-source-registry';
import type { IAudioSourceRepository } from '../audio-source-repository/i-audio-source-repository';
import type { SessionStore } from '../session/session';
import { TimelineCoordinateMapper } from '../shared/timeline-coordinate-mapper';
import type {
  RecordedTake,
  RecordingRuntimeListener,
  RecordingRuntimeState,
  SetTrackRecordArmRequest,
} from '../shared/types/linear-recording';
import {
  ProjectMutationCompensationError,
  type ProjectMutationCompensationFailure,
} from './project-mutation-compensation-error';
import type { RegionController } from './region-controller';
import { ProjectStateError, ProjectStateErrorCode } from './project-state-error';

interface RecordingControllerDependencies {
  readonly audioEngine: IAudioEngine;
  readonly audioSourceRegistry: IAudioSourceRegistry;
  readonly audioSourceRepository: IAudioSourceRepository;
  readonly createRegionId?: () => string;
  readonly createSourceId?: () => string;
  readonly regionController: RegionController;
  readonly sessionStore: SessionStore;
}

export interface StartRecordingControllerRequest {
  readonly countInBars: number;
  readonly prerollSeconds: number;
}

export class RecordingController {
  readonly #audioEngine: IAudioEngine;
  readonly #audioSourceRegistry: IAudioSourceRegistry;
  readonly #audioSourceRepository: IAudioSourceRepository;
  readonly #createRegionId: () => string;
  readonly #createSourceId: () => string;
  readonly #regionController: RegionController;
  readonly #sessionStore: SessionStore;
  #restoreMetronome: (() => void) | null = null;
  #unsubscribeRecordingStart: (() => void) | null = null;

  constructor({
    audioEngine,
    audioSourceRegistry,
    audioSourceRepository,
    createRegionId = () => globalThis.crypto.randomUUID(),
    createSourceId = () => globalThis.crypto.randomUUID(),
    regionController,
    sessionStore,
  }: RecordingControllerDependencies) {
    this.#audioEngine = audioEngine;
    this.#audioSourceRegistry = audioSourceRegistry;
    this.#audioSourceRepository = audioSourceRepository;
    this.#createRegionId = createRegionId;
    this.#createSourceId = createSourceId;
    this.#regionController = regionController;
    this.#sessionStore = sessionStore;
  }

  getRecordingState(): RecordingRuntimeState {
    return this.#audioEngine.getRecordingState();
  }

  subscribeRecordingState(listener: RecordingRuntimeListener): () => void {
    return this.#audioEngine.subscribeRecordingState(listener);
  }

  setTrackRecordArm(request: SetTrackRecordArmRequest): void {
    if (request.armed && !this.#sessionStore.getState().tracks.has(request.trackId)) {
      throw new ProjectStateError(
        ProjectStateErrorCode.TRACK_NOT_FOUND,
        `Track을 찾을 수 없습니다: ${request.trackId}`,
        {
          trackId: request.trackId,
        }
      );
    }
    this.#audioEngine.setTrackRecordArm(request);
  }

  async startRecording(request: StartRecordingControllerRequest): Promise<void> {
    const recordingState = this.#audioEngine.getRecordingState();
    if (!recordingState.armedTrackId) {
      throw new Error('녹음할 Track을 먼저 arm해야 합니다.');
    }

    const session = this.#sessionStore.getState();
    const editPointSeconds = this.#audioEngine.getCurrentTime();
    const countInDurationSeconds = this.#calculateCountInDuration(editPointSeconds, request.countInBars);
    const recordStartTimeSeconds = editPointSeconds + countInDurationSeconds;
    const transportStartTimeSeconds = Math.max(0, editPointSeconds - request.prerollSeconds);
    const startDelaySeconds = recordStartTimeSeconds - transportStartTimeSeconds;
    const previousTimeSeconds = editPointSeconds;

    this.#prepareTemporaryCountInMetronome(request.countInBars > 0, session.isMetronomeEnabled);
    this.#audioEngine.setTime(transportStartTimeSeconds);
    session.setCurrentTime(transportStartTimeSeconds);
    try {
      await this.#audioEngine.startRecording({
        recordStartTimeSeconds,
        startDelaySeconds,
        trackId: recordingState.armedTrackId,
      });
      await this.#audioEngine.play();
      this.#sessionStore.getState().setPlaying(true);
    } catch (cause) {
      if (this.#audioEngine.getRecordingState().phase !== 'idle') {
        this.#audioEngine.cancelRecording();
      }
      this.#restoreTemporaryMetronome();
      this.#audioEngine.setTime(previousTimeSeconds);
      this.#sessionStore.getState().setCurrentTime(previousTimeSeconds);
      throw cause;
    }
  }

  async stopRecording(): Promise<RecordedTake> {
    const take = await this.#audioEngine.stopRecording();
    this.#restoreTemporaryMetronome();
    return this.#persistRecordedTake(take);
  }

  cancelRecording(): void {
    this.#audioEngine.cancelRecording();
    this.#restoreTemporaryMetronome();
  }

  #calculateCountInDuration(editPointSeconds: number, countInBars: number): number {
    if (!Number.isInteger(countInBars) || countInBars < 0 || countInBars > 4) {
      throw new RangeError('Count-in은 0~4마디의 정수여야 합니다.');
    }
    if (countInBars === 0) {
      return 0;
    }

    const session = this.#sessionStore.getState();
    const initialMeter = session.meterChanges[0];
    const mapper = new TimelineCoordinateMapper({
      tempoBpm: session.tempo,
      beatsPerBar: initialMeter.beatsPerBar,
      beatUnit: initialMeter.beatUnit,
      tempoChanges: session.tempoChanges,
      meterChanges: session.meterChanges,
    });
    const startQuarterNotes = mapper.secondsToQuarterNotes(editPointSeconds);
    const meter = mapper.getMeterAtQuarterNotes(startQuarterNotes);
    const countInQuarterNotes = countInBars * meter.beatsPerBar * (4 / meter.beatUnit);
    return mapper.quarterNotesToSeconds(startQuarterNotes + countInQuarterNotes) - editPointSeconds;
  }

  #prepareTemporaryCountInMetronome(hasCountIn: boolean, wasEnabled: boolean): void {
    this.#restoreTemporaryMetronome();
    if (!hasCountIn || wasEnabled) {
      return;
    }

    this.#audioEngine.setMetronomeEnabled(true);
    this.#restoreMetronome = () => this.#audioEngine.setMetronomeEnabled(false);
    this.#unsubscribeRecordingStart = this.#audioEngine.subscribeRecordingState(state => {
      if (state.phase === 'recording') {
        this.#restoreTemporaryMetronome();
      }
    });
  }

  #restoreTemporaryMetronome(): void {
    const unsubscribe = this.#unsubscribeRecordingStart;
    const restore = this.#restoreMetronome;
    this.#unsubscribeRecordingStart = null;
    this.#restoreMetronome = null;
    unsubscribe?.();
    restore?.();
  }

  async #persistRecordedTake(take: RecordedTake): Promise<RecordedTake> {
    const sourceId = this.#createSourceId();
    const regionId = this.#createRegionId();
    const registration = {
      blob: take.blob,
      metadata: {
        byteLength: take.blob.size,
        durationSeconds: take.durationSeconds,
        fileName: `recording-${sourceId}.wav`,
        id: sourceId,
        mimeType: take.blob.type || 'audio/wav',
      },
    };
    let isStored = false;

    try {
      await this.#audioSourceRepository.create(registration);
      isStored = true;
      this.#audioSourceRegistry.restoreCommitted(registration);
      await this.#regionController.addRegion(take.trackId, {
        duration: take.durationSeconds,
        id: regionId,
        sourceId,
        sourceStartTime: 0,
        startTime: take.startedAtSeconds,
      });
      return take;
    } catch (cause) {
      const wasPublished =
        this.#sessionStore
          .getState()
          .tracks.get(take.trackId)
          ?.regions.some(region => region.id === regionId) ?? false;
      if (wasPublished) {
        return take;
      }
      await this.#rollbackRecordedSource({ cause, isStored, sourceId });
      throw cause;
    }
  }

  async #rollbackRecordedSource({
    cause,
    isStored,
    sourceId,
  }: {
    readonly cause: unknown;
    readonly isStored: boolean;
    readonly sourceId: string;
  }): Promise<void> {
    const compensationFailures: ProjectMutationCompensationFailure[] = [];
    if (this.#audioSourceRegistry.resolve(sourceId)) {
      try {
        this.#audioSourceRegistry.purgeUnused(sourceId);
      } catch (compensationCause) {
        compensationFailures.push({ cause: compensationCause, step: '녹음 Source runtime 정리' });
      }
    }
    if (isStored) {
      try {
        await this.#audioSourceRepository.delete(sourceId);
      } catch (compensationCause) {
        compensationFailures.push({ cause: compensationCause, step: '녹음 Source 저장 파일 정리' });
      }
    }
    if (compensationFailures.length > 0) {
      throw new ProjectMutationCompensationError({
        operation: 'stop-recording',
        failedPhase: '녹음 Source와 Region 연결',
        cause,
        compensationFailures,
      });
    }
  }
}
