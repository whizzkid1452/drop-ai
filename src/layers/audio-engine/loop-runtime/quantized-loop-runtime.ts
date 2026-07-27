import { calculateLoopDurationSeconds, calculateNextLoopBoundarySeconds } from '../../shared/loop-time';
import { encodeAudioBufferToWav } from '../encoders/wav-encoder';
import type { ILiveAudioInput, ILiveAudioInputConnection } from '../live-input/live-audio-input';
import type { ILivePcmCapture, ScheduledPcmCapture } from '../live-input/live-pcm-capture';
import type { ILoopPlaybackAdapter, ILoopPlayer } from './loop-playback-adapter';
import type {
  ArmLoopRuntimeRequest,
  ILoopAudioRuntime,
  LoadLoopRuntimeRequest,
  LoopRuntimeEvent,
  LoopRuntimeListener,
  LoopSlotAddress,
  SetLiveInputMonitoringRuntimeRequest,
  StopAllLoopsRequest,
  TriggerLoopRequest,
} from './loop-runtime-contract';

interface QuantizedLoopRuntimeOptions {
  readonly encodeAudioBuffer?: (audioBuffer: AudioBuffer) => Blob;
  readonly liveAudioInput: ILiveAudioInput;
  readonly pcmCapture: ILivePcmCapture;
  readonly playback: ILoopPlaybackAdapter;
}

interface PendingLoopCapture {
  readonly destination: AudioNode;
  readonly durationSeconds: number;
  readonly recordedTempoBpm: number;
  readonly quantizationBars: ArmLoopRuntimeRequest['quantizationBars'];
  readonly session: ScheduledPcmCapture;
}

interface LoopPlaybackEntry {
  readonly player: ILoopPlayer;
}

const LOOP_KEY_SEPARATOR = '\u0000';

function createLoopKey({ trackId, slotId }: LoopSlotAddress): string {
  return `${trackId}${LOOP_KEY_SEPARATOR}${slotId}`;
}

function describeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export class QuantizedLoopRuntime implements ILoopAudioRuntime {
  readonly #encodeAudioBuffer: (audioBuffer: AudioBuffer) => Blob;
  readonly #liveAudioInput: ILiveAudioInput;
  readonly #listeners = new Set<LoopRuntimeListener>();
  readonly #pcmCapture: ILivePcmCapture;
  readonly #pendingCaptures = new Map<string, PendingLoopCapture>();
  readonly #playback: ILoopPlaybackAdapter;
  readonly #playbackEntries = new Map<string, LoopPlaybackEntry>();
  #inputConnection: ILiveAudioInputConnection | null = null;
  #monitorDestination: AudioNode | null = null;

  constructor(options: QuantizedLoopRuntimeOptions) {
    this.#encodeAudioBuffer = options.encodeAudioBuffer ?? encodeAudioBufferToWav;
    this.#liveAudioInput = options.liveAudioInput;
    this.#pcmCapture = options.pcmCapture;
    this.#playback = options.playback;
  }

  async arm(request: ArmLoopRuntimeRequest): Promise<void> {
    const key = createLoopKey(request);
    const address = { slotId: request.slotId, trackId: request.trackId };
    if (this.#pendingCaptures.has(key)) {
      throw new Error('이미 녹음 대기 또는 녹음 중인 루프 슬롯입니다.');
    }

    await this.#playback.prepare();
    const durationSeconds = calculateLoopDurationSeconds(request);
    const boundaryTimeSeconds = this.#resolveBoundaryTime(request);
    if (durationSeconds === null) {
      throw new RangeError('루프 길이 또는 템포가 유효하지 않습니다.');
    }

    const connection = await this.#ensureInputConnection();
    const startTimeSeconds = this.#toContextTime(boundaryTimeSeconds);
    const session = await this.#pcmCapture.schedule({
      audioContext: this.#playback.getAudioContext(),
      durationSeconds,
      onStarted: () => {
        if (this.#pendingCaptures.get(key)?.session !== session) {
          return;
        }
        this.#emit({ ...address, state: 'recording', type: 'STATE_CHANGED' });
      },
      startTimeSeconds,
      stream: connection.stream,
    });

    const pendingCapture = {
      destination: request.destination,
      durationSeconds,
      quantizationBars: request.quantizationBars,
      recordedTempoBpm: request.tempoBpm,
      session,
    };
    this.#pendingCaptures.set(key, pendingCapture);
    this.#emit({ ...address, scheduledTimeSeconds: boundaryTimeSeconds, state: 'armed', type: 'STATE_CHANGED' });
    void session.completion
      .then(capturedPcm => this.#completeCapture(address, pendingCapture, capturedPcm))
      .catch(error => {
        if (this.#pendingCaptures.get(key) !== pendingCapture) {
          return;
        }
        this.#pendingCaptures.delete(key);
        this.#emit({ ...address, error: describeError(error), type: 'RUNTIME_ERROR' });
        this.#emit({ ...address, state: 'error', type: 'STATE_CHANGED' });
      });
  }

  cancel(address: LoopSlotAddress): void {
    const key = createLoopKey(address);
    const pendingCapture = this.#pendingCaptures.get(key);
    if (!pendingCapture) {
      return;
    }
    this.#pendingCaptures.delete(key);
    pendingCapture.session.cancel();
    this.#emit({ ...address, state: this.#playbackEntries.has(key) ? 'stopped' : 'empty', type: 'STATE_CHANGED' });
  }

  clear(address: LoopSlotAddress): void {
    this.cancel(address);
    const key = createLoopKey(address);
    const entry = this.#playbackEntries.get(key);
    entry?.player.dispose();
    this.#playbackEntries.delete(key);
    this.#emit({ ...address, state: 'empty', type: 'STATE_CHANGED' });
  }

  clearTrack(trackId: string): void {
    const keys = [...new Set([...this.#pendingCaptures.keys(), ...this.#playbackEntries.keys()])];
    keys
      .filter(key => key.startsWith(`${trackId}${LOOP_KEY_SEPARATOR}`))
      .forEach(key => {
        const slotId = key.slice(trackId.length + LOOP_KEY_SEPARATOR.length);
        this.clear({ slotId, trackId });
      });
  }

  async load(request: LoadLoopRuntimeRequest): Promise<void> {
    const response = await fetch(request.url);
    if (!response.ok) {
      throw new Error(`루프 오디오를 불러오지 못했습니다: ${response.status}`);
    }
    const audioBuffer = await this.#playback.getAudioContext().decodeAudioData(await response.arrayBuffer());
    this.#replacePlayer(request, audioBuffer);
    this.#emit({ ...request, state: 'stopped', type: 'STATE_CHANGED' });
  }

  async setInputDevice(deviceId: string | null): Promise<string | null> {
    const nextConnection = await this.#liveAudioInput.open(deviceId === null ? {} : { deviceId });
    const previousConnection = this.#inputConnection;
    this.#inputConnection = nextConnection;
    if (this.#monitorDestination) {
      this.#playback.setMonitoring({ destination: this.#monitorDestination, stream: nextConnection.stream });
    }
    previousConnection?.close();
    return nextConnection.deviceId;
  }

  async setMonitoring(request: SetLiveInputMonitoringRuntimeRequest): Promise<void> {
    if (!request.enabled) {
      this.#monitorDestination = null;
      if (this.#inputConnection) {
        this.#playback.setMonitoring({ destination: null, stream: this.#inputConnection.stream });
      }
      return;
    }

    await this.#playback.prepare();
    const connection = await this.#ensureInputConnection();
    this.#monitorDestination = request.destination;
    this.#playback.setMonitoring({ destination: request.destination, stream: connection.stream });
  }

  stop(request: TriggerLoopRequest): void {
    const entry = this.#getPlaybackEntry(request);
    const boundaryTimeSeconds = this.#resolveBoundaryTime(request);
    entry.player.stopAt(this.#toContextTime(boundaryTimeSeconds));
    this.#emit({ ...request, scheduledTimeSeconds: boundaryTimeSeconds, state: 'stopped', type: 'STATE_CHANGED' });
  }

  stopAll(request: StopAllLoopsRequest): void {
    this.#playbackEntries.forEach((_, key) => {
      const [trackId, slotId] = key.split(LOOP_KEY_SEPARATOR);
      this.stop({ ...request, slotId, trackId });
    });
  }

  subscribe(listener: LoopRuntimeListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async trigger(request: TriggerLoopRequest): Promise<void> {
    await this.#playback.prepare();
    const entry = this.#getPlaybackEntry(request);
    const boundaryTimeSeconds = this.#resolveBoundaryTime(request);
    entry.player.startAt(this.#toContextTime(boundaryTimeSeconds));
    this.#emit({ ...request, scheduledTimeSeconds: boundaryTimeSeconds, state: 'playing', type: 'STATE_CHANGED' });
  }

  async #completeCapture(
    address: LoopSlotAddress,
    pendingCapture: PendingLoopCapture,
    capturedPcm: { readonly channels: readonly Float32Array[]; readonly sampleRate: number }
  ): Promise<void> {
    const key = createLoopKey(address);
    if (this.#pendingCaptures.get(key) !== pendingCapture) {
      return;
    }
    this.#pendingCaptures.delete(key);

    const audioBuffer = this.#playback.createAudioBuffer(capturedPcm);
    const blob = this.#encodeAudioBuffer(audioBuffer);
    const player = this.#replacePlayer({ ...address, destination: pendingCapture.destination }, audioBuffer);
    const nextBoundaryTimeSeconds = this.#resolveBoundaryTime({
      ...address,
      quantizationBars: pendingCapture.quantizationBars,
      tempoBpm: pendingCapture.recordedTempoBpm,
    });
    player.startAt(this.#toContextTime(nextBoundaryTimeSeconds));
    this.#emit({
      ...address,
      blob,
      durationSeconds: pendingCapture.durationSeconds,
      recordedTempoBpm: pendingCapture.recordedTempoBpm,
      type: 'RECORDING_COMPLETED',
    });
    this.#emit({ ...address, scheduledTimeSeconds: nextBoundaryTimeSeconds, state: 'playing', type: 'STATE_CHANGED' });
  }

  async #ensureInputConnection(): Promise<ILiveAudioInputConnection> {
    if (this.#inputConnection) {
      return this.#inputConnection;
    }
    await this.setInputDevice(null);
    if (!this.#inputConnection) {
      throw new Error('오디오 입력 연결을 만들지 못했습니다.');
    }
    return this.#inputConnection;
  }

  #emit(event: LoopRuntimeEvent): void {
    this.#listeners.forEach(listener => listener(event));
  }

  #getPlaybackEntry(address: LoopSlotAddress): LoopPlaybackEntry {
    const entry = this.#playbackEntries.get(createLoopKey(address));
    if (!entry) {
      throw new Error('루프 슬롯에 재생할 오디오가 없습니다.');
    }
    return entry;
  }

  #replacePlayer(
    request: LoopSlotAddress & { readonly destination: AudioNode },
    audioBuffer: AudioBuffer
  ): ILoopPlayer {
    const key = createLoopKey(request);
    this.#playbackEntries.get(key)?.player.dispose();
    const player = this.#playback.createPlayer({ audioBuffer, destination: request.destination });
    this.#playbackEntries.set(key, { player });
    return player;
  }

  #resolveBoundaryTime(request: TriggerLoopRequest): number {
    const boundaryTimeSeconds = calculateNextLoopBoundarySeconds({
      currentTimeSeconds: this.#playback.getTransportTimeSeconds(),
      originTimeSeconds: 0,
      quantizationBars: request.quantizationBars,
      tempoBpm: request.tempoBpm,
    });
    if (boundaryTimeSeconds === null) {
      throw new RangeError('정량화 기준 또는 템포가 유효하지 않습니다.');
    }
    return boundaryTimeSeconds;
  }

  #toContextTime(transportBoundaryTimeSeconds: number): number {
    const delaySeconds = Math.max(0, transportBoundaryTimeSeconds - this.#playback.getTransportTimeSeconds());
    return this.#playback.getContextTimeSeconds() + delaySeconds;
  }
}
