import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import type { IAudioSourceRegistry } from '../audio-source-registry/i-audio-source-registry';
import type { IAudioSourceRepository } from '../audio-source-repository/i-audio-source-repository';
import type { SessionStore } from '../session/session';
import { TimelineCoordinateMapper } from '../shared/timeline-coordinate-mapper';
import type {
  MultiTrackRecordingResult,
  RecordedTake,
  RecordingRuntimeListener,
  RecordingRuntimeState,
  SetTrackRecordArmRequest,
  SetTrackRecordingInputRequest,
} from '../shared/types/linear-recording';
import {
  createDefaultTrackRecordingState,
  type CompSegmentState,
  type PlaylistState,
  type RecordMode,
  type TakeState,
} from '../shared/types/multitrack-recording';
import { createDefaultRegionProcessingState } from '../shared/types/region-processing';
import type { TimelineRange } from '../shared/types/project-document.schema';
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
  readonly createPlaylistId?: () => string;
  readonly createCompSegmentId?: () => string;
  readonly createSourceId?: () => string;
  readonly createTakeId?: () => string;
  readonly now?: () => number;
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
  readonly #createPlaylistId: () => string;
  readonly #createCompSegmentId: () => string;
  readonly #createSourceId: () => string;
  readonly #createTakeId: () => string;
  readonly #now: () => number;
  readonly #regionController: RegionController;
  readonly #sessionStore: SessionStore;
  #restoreMetronome: (() => void) | null = null;
  #unsubscribeRecordingStart: (() => void) | null = null;

  constructor({
    audioEngine,
    audioSourceRegistry,
    audioSourceRepository,
    createPlaylistId = () => globalThis.crypto.randomUUID(),
    createCompSegmentId = () => globalThis.crypto.randomUUID(),
    createSourceId = () => globalThis.crypto.randomUUID(),
    createTakeId = () => globalThis.crypto.randomUUID(),
    now = () => Date.now(),
    regionController,
    sessionStore,
  }: RecordingControllerDependencies) {
    this.#audioEngine = audioEngine;
    this.#audioSourceRegistry = audioSourceRegistry;
    this.#audioSourceRepository = audioSourceRepository;
    this.#createPlaylistId = createPlaylistId;
    this.#createCompSegmentId = createCompSegmentId;
    this.#createSourceId = createSourceId;
    this.#createTakeId = createTakeId;
    this.#now = now;
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

  setTrackRecordingInput(request: SetTrackRecordingInputRequest): void {
    if (!this.#sessionStore.getState().tracks.has(request.trackId)) {
      throw new ProjectStateError(
        ProjectStateErrorCode.TRACK_NOT_FOUND,
        `Track을 찾을 수 없습니다: ${request.trackId}`,
        {
          trackId: request.trackId,
        }
      );
    }
    this.#audioEngine.setTrackRecordingInput(request);
  }

  setPunchRecording(request: { readonly isEnabled: boolean; readonly range: TimelineRange | null }): void {
    if (request.isEnabled && request.range === null) {
      throw new RangeError('활성 Punch 녹음에는 범위가 필요합니다.');
    }
    if (request.range && request.range.endTimeSeconds <= request.range.startTimeSeconds) {
      throw new RangeError('Punch 끝 시각은 시작 시각보다 커야 합니다.');
    }
    const recording = this.#sessionStore.getState().recording;
    this.#sessionStore.getState().setRecording({
      ...recording,
      punch: { isEnabled: request.isEnabled, range: request.range ? { ...request.range } : null },
    });
  }

  setTrackRecordMode(request: { readonly recordMode: RecordMode; readonly trackId: string }): void {
    const track = this.#getTrackOrThrow(request.trackId);
    const recording = track.recording ?? createDefaultTrackRecordingState();
    this.#sessionStore.getState().updateTrack(request.trackId, {
      recording: { ...recording, recordMode: request.recordMode },
    });
  }

  async selectTake(request: { readonly playlistId: string; readonly takeId: string; readonly trackId: string }) {
    const playlist = this.#getPlaylistOrThrow(request);
    const take = this.#getTakeOrThrow(playlist, request.takeId);
    await this.setCompSegments({
      compSegments: [
        {
          endTimeSeconds: take.startTimeSeconds + take.durationSeconds,
          id: this.#createCompSegmentId(),
          startTimeSeconds: take.startTimeSeconds,
          takeId: take.id,
        },
      ],
      playlistId: request.playlistId,
      trackId: request.trackId,
    });
  }

  async setCompSegments(request: {
    readonly compSegments: readonly CompSegmentState[];
    readonly playlistId: string;
    readonly trackId: string;
  }): Promise<void> {
    const track = this.#getTrackOrThrow(request.trackId);
    const recording = track.recording ?? createDefaultTrackRecordingState();
    const playlist = this.#getPlaylistOrThrow(request);
    this.#validateCompSegments(playlist, request.compSegments);

    const previousCompRegionIds = new Set([
      ...playlist.compSegments.map(segment => segment.id),
      ...playlist.takes.map(take => take.id),
    ]);
    const preservedRegions = track.regions.filter(
      region =>
        !previousCompRegionIds.has(region.id) &&
        !playlist.takes.some(
          take =>
            take.sourceId === region.sourceId &&
            take.sourceStartTimeSeconds === region.sourceStartTime &&
            take.startTimeSeconds === region.startTime &&
            take.durationSeconds === region.duration
        )
    );
    const segmentsToRender =
      request.compSegments.length > 0
        ? request.compSegments
        : playlist.takes.map(take => ({
            endTimeSeconds: take.startTimeSeconds + take.durationSeconds,
            id: take.id,
            startTimeSeconds: take.startTimeSeconds,
            takeId: take.id,
          }));
    const compRegions = segmentsToRender.map((segment, index) => {
      const take = this.#getTakeOrThrow(playlist, segment.takeId);
      const processing = createDefaultRegionProcessingState(index);
      return {
        durationSeconds: segment.endTimeSeconds - segment.startTimeSeconds,
        ...processing,
        isOpaque: recording.recordMode !== 'soundOnSound',
        id: segment.id,
        sourceId: take.sourceId,
        sourceStartTimeSeconds: take.sourceStartTimeSeconds + (segment.startTimeSeconds - take.startTimeSeconds),
        startTimeSeconds: segment.startTimeSeconds,
      };
    });
    const transportTimeSeconds = this.#audioEngine.getCurrentTime();
    const wasPlaying = this.#sessionStore.getState().isPlaying;
    const recordingRuntimeState = this.#audioEngine.getRecordingState();
    await this.#regionController.replaceTrackRegions({
      tracks: [
        {
          regions: [
            ...preservedRegions.map(region => ({
              durationSeconds: region.duration,
              fadeIn: { ...region.fadeIn },
              fadeOut: { ...region.fadeOut },
              gain: region.gain,
              id: region.id,
              isOpaque: region.isOpaque,
              layer: region.layer,
              sourceId: region.sourceId,
              sourceStartTimeSeconds: region.sourceStartTime,
              startTimeSeconds: region.startTime,
            })),
            ...compRegions,
          ],
          trackId: request.trackId,
        },
      ],
    });
    recordingRuntimeState.inputRoutes.forEach(inputRoute => this.#audioEngine.setTrackRecordingInput(inputRoute));
    recordingRuntimeState.armedTrackIds.forEach(trackId =>
      this.#audioEngine.setTrackRecordArm({ armed: true, trackId })
    );
    this.#audioEngine.setTime(transportTimeSeconds);
    if (wasPlaying) {
      await this.#audioEngine.play();
    }
    this.#sessionStore.getState().updateTrack(request.trackId, {
      recording: {
        activePlaylistId: request.playlistId,
        playlists: recording.playlists.map(candidate =>
          candidate.id === request.playlistId
            ? { ...candidate, compSegments: request.compSegments.map(segment => ({ ...segment })) }
            : candidate
        ),
        recordMode: recording.recordMode,
      },
    });
  }

  async startRecording(request: StartRecordingControllerRequest): Promise<void> {
    const recordingState = this.#audioEngine.getRecordingState();
    if (recordingState.armedTrackIds.length === 0) {
      throw new Error('녹음할 Track을 먼저 arm해야 합니다.');
    }

    const session = this.#sessionStore.getState();
    const editPointSeconds = this.#audioEngine.getCurrentTime();
    const countInDurationSeconds = this.#calculateCountInDuration(editPointSeconds, request.countInBars);
    const countInEndTimeSeconds = editPointSeconds + countInDurationSeconds;
    const punch = session.recording.punch;
    if (punch.isEnabled && punch.range && editPointSeconds >= punch.range.endTimeSeconds) {
      throw new RangeError('재생 위치가 Punch 범위 끝 이후입니다.');
    }
    const recordStartTimeSeconds =
      punch.isEnabled && punch.range
        ? Math.max(countInEndTimeSeconds, punch.range.startTimeSeconds)
        : countInEndTimeSeconds;
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

  async stopRecording(): Promise<MultiTrackRecordingResult> {
    const result = await this.#audioEngine.stopRecording();
    this.#restoreTemporaryMetronome();
    const persistedTakes: RecordedTake[] = [];
    const failures = [...result.failures];
    for (const take of result.takes) {
      try {
        persistedTakes.push(await this.#persistRecordedTake(take));
      } catch (cause) {
        failures.push({ cause, stage: 'persist', trackId: take.trackId });
      }
    }
    return { failures, takes: persistedTakes };
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
    const publishedTake = this.#createPublishedTake(take);
    const sourceId = this.#createSourceId();
    const takeId = this.#createTakeId();
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
    const track = this.#getTrackOrThrow(take.trackId);
    const previousRecording = track.recording ?? createDefaultTrackRecordingState();

    try {
      await this.#audioSourceRepository.create(registration);
      isStored = true;
      this.#audioSourceRegistry.restoreCommitted(registration);
      const playlist = this.#appendTakeToActivePlaylist({
        sourceId,
        sourceStartTimeSeconds: publishedTake.sourceStartTimeSeconds,
        take: publishedTake.take,
        takeId,
      });
      await this.setCompSegments({
        compSegments: playlist.compSegments,
        playlistId: playlist.id,
        trackId: take.trackId,
      });
      return publishedTake.take;
    } catch (cause) {
      this.#sessionStore.getState().updateTrack(take.trackId, { recording: previousRecording });
      await this.#rollbackRecordedSource({ cause, isStored, sourceId });
      throw cause;
    }
  }

  #appendTakeToActivePlaylist({
    sourceId,
    sourceStartTimeSeconds,
    take,
    takeId,
  }: {
    readonly sourceId: string;
    readonly sourceStartTimeSeconds: number;
    readonly take: RecordedTake;
    readonly takeId: string;
  }): PlaylistState {
    const session = this.#sessionStore.getState();
    const track = session.tracks.get(take.trackId);
    if (!track) {
      throw new ProjectStateError(
        ProjectStateErrorCode.TRACK_NOT_FOUND,
        `녹음 Take를 연결할 Track을 찾을 수 없습니다: ${take.trackId}`,
        { trackId: take.trackId }
      );
    }
    const recording = track.recording ?? createDefaultTrackRecordingState();
    const playlistId = recording.activePlaylistId ?? recording.playlists[0]?.id ?? this.#createPlaylistId();
    const takeState = {
      createdAtEpochMilliseconds: this.#now(),
      durationSeconds: take.durationSeconds,
      id: takeId,
      sourceId,
      sourceStartTimeSeconds,
      startTimeSeconds: take.startedAtSeconds,
      takeNumber: (recording.playlists.find(playlist => playlist.id === playlistId)?.takes.length ?? 0) + 1,
    };
    const hasPlaylist = recording.playlists.some(playlist => playlist.id === playlistId);
    const playlists = hasPlaylist
      ? recording.playlists.map(playlist =>
          playlist.id === playlistId ? { ...playlist, takes: [...playlist.takes, takeState] } : playlist
        )
      : [
          ...recording.playlists,
          { compSegments: [], id: playlistId, name: `Playlist ${recording.playlists.length + 1}`, takes: [takeState] },
        ];
    session.updateTrack(take.trackId, {
      recording: { activePlaylistId: playlistId, playlists, recordMode: recording.recordMode },
    });
    const playlist = playlists.find(candidate => candidate.id === playlistId);
    if (!playlist) {
      throw new Error(`생성한 Playlist를 찾을 수 없습니다: ${playlistId}`);
    }
    return playlist;
  }

  #createPublishedTake(take: RecordedTake): {
    readonly sourceStartTimeSeconds: number;
    readonly take: RecordedTake;
  } {
    const punch = this.#sessionStore.getState().recording.punch;
    if (!punch.isEnabled || !punch.range) {
      return { sourceStartTimeSeconds: 0, take };
    }
    const takeEndTimeSeconds = take.startedAtSeconds + take.durationSeconds;
    const startTimeSeconds = Math.max(take.startedAtSeconds, punch.range.startTimeSeconds);
    const endTimeSeconds = Math.min(takeEndTimeSeconds, punch.range.endTimeSeconds);
    if (endTimeSeconds <= startTimeSeconds) {
      throw new RangeError(`Track 녹음 결과가 Punch 범위와 겹치지 않습니다: ${take.trackId}`);
    }
    return {
      sourceStartTimeSeconds: startTimeSeconds - take.startedAtSeconds,
      take: { ...take, durationSeconds: endTimeSeconds - startTimeSeconds, startedAtSeconds: startTimeSeconds },
    };
  }

  #getTrackOrThrow(trackId: string) {
    const track = this.#sessionStore.getState().tracks.get(trackId);
    if (!track) {
      throw new ProjectStateError(ProjectStateErrorCode.TRACK_NOT_FOUND, `Track을 찾을 수 없습니다: ${trackId}`, {
        trackId,
      });
    }
    return track;
  }

  #getPlaylistOrThrow(request: { readonly playlistId: string; readonly trackId: string }): PlaylistState {
    const track = this.#getTrackOrThrow(request.trackId);
    const playlist = track.recording?.playlists.find(candidate => candidate.id === request.playlistId);
    if (!playlist) {
      throw new Error(`Playlist를 찾을 수 없습니다: ${request.playlistId}`);
    }
    return playlist;
  }

  #getTakeOrThrow(playlist: PlaylistState, takeId: string): TakeState {
    const take = playlist.takes.find(candidate => candidate.id === takeId);
    if (!take) {
      throw new Error(`Take를 찾을 수 없습니다: ${takeId}`);
    }
    return take;
  }

  #validateCompSegments(playlist: PlaylistState, segments: readonly CompSegmentState[]): void {
    const orderedSegments = [...segments].sort((left, right) => left.startTimeSeconds - right.startTimeSeconds);
    const ids = new Set<string>();
    orderedSegments.forEach((segment, index) => {
      if (ids.has(segment.id)) {
        throw new Error(`중복 Comp Segment ID입니다: ${segment.id}`);
      }
      ids.add(segment.id);
      const take = this.#getTakeOrThrow(playlist, segment.takeId);
      const takeEndTimeSeconds = take.startTimeSeconds + take.durationSeconds;
      if (
        segment.endTimeSeconds <= segment.startTimeSeconds ||
        segment.startTimeSeconds < take.startTimeSeconds ||
        segment.endTimeSeconds > takeEndTimeSeconds
      ) {
        throw new RangeError(`Comp Segment가 Take 범위를 벗어납니다: ${segment.id}`);
      }
      if (index > 0 && segment.startTimeSeconds < orderedSegments[index - 1].endTimeSeconds) {
        throw new RangeError('Comp Segment는 서로 겹칠 수 없습니다.');
      }
    });
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
