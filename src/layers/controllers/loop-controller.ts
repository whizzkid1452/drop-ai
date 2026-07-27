import type {
  ArmLoopRequest,
  IAudioEngine,
  LoopRuntimeEvent,
  LoopSlotAddress,
  SetLiveInputMonitoringRequest,
} from '../audio-engine/i-audio-engine';
import type { IAudioSourceRegistry, RuntimeAudioSource } from '../audio-source-registry/i-audio-source-registry';
import type { LoopSlotState, SessionStore } from '../session/session';
import { ProjectStateError, ProjectStateErrorCode } from './project-state-error';

interface LoopControllerDependencies {
  readonly audioEngine: IAudioEngine;
  readonly audioSourceRegistry: IAudioSourceRegistry;
  readonly createSourceId?: () => string;
  readonly sessionStore: SessionStore;
}

type ArmLoopControllerRequest = Omit<ArmLoopRequest, 'tempoBpm'>;

export class LoopController {
  readonly #audioEngine: IAudioEngine;
  readonly #audioSourceRegistry: IAudioSourceRegistry;
  readonly #createSourceId: () => string;
  readonly #sessionStore: SessionStore;

  constructor({
    audioEngine,
    audioSourceRegistry,
    createSourceId = () => globalThis.crypto.randomUUID(),
    sessionStore,
  }: LoopControllerDependencies) {
    this.#audioEngine = audioEngine;
    this.#audioSourceRegistry = audioSourceRegistry;
    this.#createSourceId = createSourceId;
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
    const source = this.#resolveAttachedSource(address, slot.sourceId);
    this.#audioEngine.clearLoop(address);
    if (source) {
      try {
        this.#audioSourceRegistry.detachLoopSlot({ loopSlotId: address.slotId, sourceId: source.metadata.id });
        this.#audioSourceRegistry.purgeUnused(source.metadata.id);
      } catch (cause) {
        await this.#restoreClearedLoop(address, source);
        throw cause;
      }
    }

    this.#sessionStore.getState().updateLoopSlot({
      ...address,
      updates: {
        errorMessage: null,
        recordedTempoBpm: null,
        scheduledTimeSeconds: null,
        sourceId: null,
        state: 'empty',
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

  #attachRecordedSource(event: Extract<LoopRuntimeEvent, { type: 'RECORDING_COMPLETED' }>): void {
    const slot = this.#getLoopSlot(event);
    if (slot.sourceId !== null) {
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
        fileName: `loop-${event.slotId}.wav`,
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
        sourceId,
      },
    });
  }

  #resolveAttachedSource(address: LoopSlotAddress, sourceId: string | null): RuntimeAudioSource | null {
    if (sourceId === null) {
      return null;
    }
    const source = this.#audioSourceRegistry.resolve(sourceId);
    if (source?.loopSlotIds?.includes(address.slotId)) {
      return source;
    }
    throw new ProjectStateError(
      ProjectStateErrorCode.LOOP_SLOT_SOURCE_MISSING,
      `루프 슬롯의 Source 연결을 찾을 수 없습니다: ${address.slotId}`,
      { ...address, sourceId }
    );
  }

  async #restoreClearedLoop(address: LoopSlotAddress, source: RuntimeAudioSource): Promise<void> {
    const currentSource = this.#audioSourceRegistry.resolve(source.metadata.id);
    if (currentSource && !currentSource.loopSlotIds?.includes(address.slotId)) {
      this.#audioSourceRegistry.attachLoopSlot({ loopSlotId: address.slotId, sourceId: source.metadata.id });
    }
    await this.#audioEngine.loadLoop({ ...address, url: source.objectUrl });
  }
}
