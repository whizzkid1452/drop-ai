import type {
  ArmLoopRequest,
  IAudioEngine,
  LoopRuntimeEvent,
  LoopSlotAddress,
  SetLiveInputMonitoringRequest,
} from '../audio-engine/i-audio-engine';
import type { IAudioSourceRegistry, RuntimeAudioSource } from '../audio-source-registry/i-audio-source-registry';
import type { LoopSlotState, SessionStore } from '../session/session';
import type { ClipFollowAction, ClipLaunchMode } from '../shared/types/clip-cue-state';
import { MAX_LOOP_OVERDUB_LAYERS } from '../shared/loop-time';
import { ProjectStateError, ProjectStateErrorCode } from './project-state-error';

interface LoopControllerDependencies {
  readonly audioEngine: IAudioEngine;
  readonly audioSourceRegistry: IAudioSourceRegistry;
  readonly createSourceId?: () => string;
  readonly persistProjectChange?: () => Promise<void>;
  readonly reportPersistenceFailure?: (cause: unknown) => void;
  readonly sessionStore: SessionStore;
}

type ArmLoopControllerRequest = Omit<ArmLoopRequest, 'tempoBpm'>;

export interface ConfigureClipSlotRequest extends LoopSlotAddress {
  readonly followAction: ClipFollowAction;
  readonly gain: number;
  readonly launchMode: ClipLaunchMode;
  readonly name: string;
  readonly quantizationBars: LoopSlotState['quantizationBars'];
  readonly sourceEndTimeSeconds: number | null;
  readonly sourceStartTimeSeconds: number;
}

export class LoopController {
  readonly #audioEngine: IAudioEngine;
  readonly #audioSourceRegistry: IAudioSourceRegistry;
  readonly #createSourceId: () => string;
  readonly #persistProjectChange: () => Promise<void>;
  readonly #reportPersistenceFailure: (cause: unknown) => void;
  readonly #sessionStore: SessionStore;
  #persistenceTail: Promise<void> = Promise.resolve();

  constructor({
    audioEngine,
    audioSourceRegistry,
    createSourceId = () => globalThis.crypto.randomUUID(),
    persistProjectChange = async () => undefined,
    reportPersistenceFailure = cause => console.error('[LoopController] 녹음 완료 프로젝트 저장 실패', cause),
    sessionStore,
  }: LoopControllerDependencies) {
    this.#audioEngine = audioEngine;
    this.#audioSourceRegistry = audioSourceRegistry;
    this.#createSourceId = createSourceId;
    this.#persistProjectChange = persistProjectChange;
    this.#reportPersistenceFailure = reportPersistenceFailure;
    this.#sessionStore = sessionStore;
    this.#audioEngine.subscribeLoopEvents(event => this.#handleRuntimeEvent(event));
  }

  async setInputDevice(deviceId: string | null): Promise<string | null> {
    return this.#audioEngine.setLiveInputDevice(deviceId);
  }

  async setMonitoring(request: SetLiveInputMonitoringRequest): Promise<void> {
    this.#getTrackLoopSlotContainer(request.trackId);
    await this.#audioEngine.setLiveInputMonitoring(request);
  }

  async arm(request: ArmLoopControllerRequest): Promise<void> {
    const slot = this.#getLoopSlot(request);
    if (slot.sourceId !== null) {
      throw new ProjectStateError(
        ProjectStateErrorCode.LOOP_SLOT_NOT_EMPTY,
        `비어 있지 않은 루프 슬롯은 녹음 대기할 수 없습니다: ${request.slotId}`,
        { ...request }
      );
    }

    if (!this.#sessionStore.getState().isPlaying) {
      await this.#audioEngine.play();
      this.#sessionStore.getState().setPlaying(true);
    }

    await this.#audioEngine.armLoop({ ...request, tempoBpm: this.#sessionStore.getState().tempo });
    this.#sessionStore.getState().updateLoopSlot({
      ...request,
      updates: {
        errorMessage: null,
        lengthBars: request.lengthBars,
        quantizationBars: request.quantizationBars,
      },
    });
  }

  async overdub(address: LoopSlotAddress): Promise<void> {
    const slot = this.#getLoopSlot(address);
    if (slot.sourceId === null || slot.state !== 'playing') {
      throw new ProjectStateError(
        ProjectStateErrorCode.LOOP_SLOT_NOT_PLAYING,
        `재생 중인 루프 슬롯만 오버더빙할 수 있습니다: ${address.slotId}`,
        { ...address, state: slot.state }
      );
    }
    if (slot.overdubSourceIds.length >= MAX_LOOP_OVERDUB_LAYERS) {
      throw new ProjectStateError(
        ProjectStateErrorCode.LOOP_SLOT_OVERDUB_LIMIT_REACHED,
        `루프 슬롯의 오버더빙 레이어 한도에 도달했습니다: ${address.slotId}`,
        { ...address, maximumOverdubLayerCount: MAX_LOOP_OVERDUB_LAYERS }
      );
    }
    await this.#audioEngine.armLoopOverdub({
      ...address,
      lengthBars: slot.lengthBars,
      quantizationBars: slot.quantizationBars,
      tempoBpm: this.#sessionStore.getState().tempo,
    });
  }

  cancel(address: LoopSlotAddress): void {
    this.#getLoopSlot(address);
    this.#audioEngine.cancelLoop(address);
  }

  async trigger(address: LoopSlotAddress): Promise<void> {
    const slot = this.#getLoopSlot(address);
    await this.#audioEngine.triggerLoop({
      ...address,
      quantizationBars: slot.quantizationBars,
      tempoBpm: this.#sessionStore.getState().tempo,
    });
  }

  stop(address: LoopSlotAddress): void {
    const slot = this.#getLoopSlot(address);
    this.#audioEngine.stopLoop({
      ...address,
      quantizationBars: slot.quantizationBars,
      tempoBpm: this.#sessionStore.getState().tempo,
    });
  }

  async clear(address: LoopSlotAddress): Promise<void> {
    const slot = this.#getLoopSlot(address);
    const sources = this.#resolveAttachedSources(address, slot);
    this.#audioEngine.clearLoop(address);
    try {
      sources.forEach(source => {
        this.#audioSourceRegistry.detachLoopSlot({ loopSlotId: address.slotId, sourceId: source.metadata.id });
      });
    } catch (cause) {
      await this.#restoreClearedLoop(address, sources);
      throw cause;
    }

    this.#sessionStore.getState().updateLoopSlot({
      ...address,
      updates: {
        errorMessage: null,
        overdubSourceIds: [],
        recordedTempoBpm: null,
        scheduledTimeSeconds: null,
        sourceId: null,
        state: 'empty',
      },
    });
    sources.forEach(source => this.#audioSourceRegistry.purgeUnused(source.metadata.id));
  }

  configureClip(request: ConfigureClipSlotRequest): void {
    const slot = this.#getLoopSlot(request);
    this.#assertValidSourceRange(request, slot);
    if (slot.sourceId !== null) {
      this.#audioEngine.configureLoop(request);
    }
    this.#sessionStore.getState().updateLoopSlot({
      ...request,
      updates: {
        followAction: { ...request.followAction },
        gain: request.gain,
        launchMode: request.launchMode,
        name: request.name,
        quantizationBars: request.quantizationBars,
        sourceEndTimeSeconds: request.sourceEndTimeSeconds,
        sourceStartTimeSeconds: request.sourceStartTimeSeconds,
      },
    });
  }

  stopAll(): void {
    const session = this.#sessionStore.getState();
    this.#audioEngine.stopAllLoops({ quantizationBars: 1, tempoBpm: session.tempo });
  }

  #getTrackLoopSlotContainer(trackId: string): readonly LoopSlotState[] {
    const track = this.#sessionStore.getState().tracks.get(trackId);
    if (track) {
      return track.loopSlots ?? [];
    }
    throw new ProjectStateError(ProjectStateErrorCode.TRACK_NOT_FOUND, `Track을 찾을 수 없습니다: ${trackId}`, {
      trackId,
    });
  }

  #getLoopSlot(address: LoopSlotAddress): LoopSlotState {
    const slot = this.#getTrackLoopSlotContainer(address.trackId).find(candidate => candidate.id === address.slotId);
    if (slot) {
      return slot;
    }
    throw new ProjectStateError(
      ProjectStateErrorCode.LOOP_SLOT_NOT_FOUND,
      `루프 슬롯을 찾을 수 없습니다: ${address.slotId}`,
      { ...address }
    );
  }

  #handleRuntimeEvent(event: LoopRuntimeEvent): void {
    if (event.type === 'RECORDING_COMPLETED') {
      this.#attachRecordedSource(event);
      this.#enqueueProjectPersistence();
      return;
    }
    if (event.type === 'RUNTIME_ERROR') {
      this.#sessionStore.getState().updateLoopSlot({
        ...event,
        updates: { errorMessage: event.error.message, state: 'error' },
      });
      return;
    }

    this.#sessionStore.getState().updateLoopSlot({
      ...event,
      updates: {
        errorMessage: event.state === 'error' ? this.#getLoopSlot(event).errorMessage : null,
        scheduledTimeSeconds: event.scheduledTimeSeconds ?? null,
        state: event.state,
      },
    });
  }

  #assertValidSourceRange(request: ConfigureClipSlotRequest, slot: LoopSlotState): void {
    if (
      request.sourceStartTimeSeconds < 0 ||
      (request.sourceEndTimeSeconds !== null && request.sourceEndTimeSeconds <= request.sourceStartTimeSeconds)
    ) {
      throw new RangeError('Clip Source 범위가 유효하지 않습니다.');
    }
    if (slot.sourceId === null) {
      if (request.sourceStartTimeSeconds !== 0 || request.sourceEndTimeSeconds !== null) {
        throw new RangeError('빈 Clip Slot에는 Source 범위를 설정할 수 없습니다.');
      }
      return;
    }
    const durationSeconds = this.#audioSourceRegistry.resolve(slot.sourceId)?.metadata.durationSeconds;
    if (
      durationSeconds !== null &&
      durationSeconds !== undefined &&
      (request.sourceStartTimeSeconds >= durationSeconds ||
        (request.sourceEndTimeSeconds ?? durationSeconds) > durationSeconds)
    ) {
      throw new RangeError('Clip Source 범위가 Source 길이를 벗어납니다.');
    }
  }

  #enqueueProjectPersistence(): void {
    // 녹음 완료는 명령 반환 뒤 발생하므로 이벤트별 저장을 순서대로 이어 Outbox revision 순서를 보존한다.
    const persistence = this.#persistenceTail.then(() => this.#persistProjectChange());
    this.#persistenceTail = persistence.catch(cause => this.#reportPersistenceFailure(cause));
  }

  #attachRecordedSource(event: Extract<LoopRuntimeEvent, { type: 'RECORDING_COMPLETED' }>): void {
    const slot = this.#getLoopSlot(event);
    const hasInvalidTarget =
      (event.captureMode === 'initial' && slot.sourceId !== null) ||
      (event.captureMode === 'overdub' && slot.sourceId === null);
    if (hasInvalidTarget) {
      this.#sessionStore.getState().updateLoopSlot({
        ...event,
        updates: { errorMessage: '비어 있지 않은 루프 슬롯에 녹음 결과를 연결할 수 없습니다.', state: 'error' },
      });
      return;
    }

    const sourceId = this.#createSourceId();
    this.#audioSourceRegistry.stage({
      blob: event.blob,
      metadata: {
        byteLength: event.blob.size,
        durationSeconds: event.durationSeconds,
        fileName: `loop-${event.slotId}-${event.captureMode}.wav`,
        id: sourceId,
        mimeType: event.blob.type || 'audio/wav',
      },
    });

    try {
      this.#audioSourceRegistry.attachLoopSlot({ loopSlotId: event.slotId, sourceId });
    } catch (cause) {
      this.#audioSourceRegistry.discardPending(sourceId);
      throw cause;
    }

    this.#sessionStore.getState().updateLoopSlot({
      ...event,
      updates: {
        errorMessage: null,
        recordedTempoBpm: event.recordedTempoBpm,
        ...(event.captureMode === 'initial'
          ? { sourceId }
          : { overdubSourceIds: [...slot.overdubSourceIds, sourceId] }),
      },
    });
    const configuredSlot = this.#getLoopSlot(event);
    this.#audioEngine.configureLoop({
      gain: configuredSlot.gain,
      slotId: event.slotId,
      sourceEndTimeSeconds: configuredSlot.sourceEndTimeSeconds,
      sourceStartTimeSeconds: configuredSlot.sourceStartTimeSeconds,
      trackId: event.trackId,
    });
  }

  #resolveAttachedSources(address: LoopSlotAddress, slot: LoopSlotState): RuntimeAudioSource[] {
    const sourceIds = slot.sourceId === null ? [] : [slot.sourceId, ...slot.overdubSourceIds];
    return sourceIds.map(sourceId => {
      const source = this.#audioSourceRegistry.resolve(sourceId);
      if (source?.loopSlotIds?.includes(address.slotId)) {
        return source;
      }
      throw new ProjectStateError(
        ProjectStateErrorCode.LOOP_SLOT_SOURCE_MISSING,
        `루프 슬롯의 Source 연결을 찾을 수 없습니다: ${address.slotId}`,
        { ...address, sourceId }
      );
    });
  }

  async #restoreClearedLoop(address: LoopSlotAddress, sources: readonly RuntimeAudioSource[]): Promise<void> {
    for (const source of sources) {
      const currentSource = this.#audioSourceRegistry.resolve(source.metadata.id);
      if (currentSource && !currentSource.loopSlotIds?.includes(address.slotId)) {
        this.#audioSourceRegistry.attachLoopSlot({ loopSlotId: address.slotId, sourceId: source.metadata.id });
      }
      await this.#audioEngine.loadLoop({ ...address, url: source.objectUrl });
    }
  }
}
