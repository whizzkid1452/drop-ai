import { calculateLoopDurationSeconds, calculateNextLoopBoundarySeconds } from '../../shared/loop-time';
import { COMPLETE_RESOURCE_CLEANUP, type ResourceCleanupResult } from '../../shared/types/resource-cleanup';
import { encodeAudioBufferToWav } from '../encoders/wav-encoder';
import type { ILiveAudioInput, ILiveAudioInputConnection } from '../live-input/live-audio-input';
import type { ActivePcmCapture, ILivePcmCapture, ScheduledPcmCapture } from '../live-input/live-pcm-capture';
import type {
  ILinearRecordingAudioRuntime,
  LinearRecordingCapture,
  LinearRecordingTrackResult,
  StartLinearRecordingRuntimeRequest,
} from '../recording-runtime/linear-recording-runtime';
import type { ILoopPlaybackAdapter, ILoopPlayer } from './loop-playback-adapter';
import type {
  ArmLoopRuntimeRequest,
  ILoopAudioRuntime,
  IPreparedLoopRuntimeReplacement,
  IRetiredLoopRuntime,
  LoadLoopRuntimeRequest,
  LoopCaptureMode,
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
  readonly captureMode: LoopCaptureMode;
  readonly destination: AudioNode;
  readonly durationSeconds: number;
  readonly recordedTempoBpm: number;
  readonly quantizationBars: ArmLoopRuntimeRequest['quantizationBars'];
  readonly session: ScheduledPcmCapture;
}

interface LoopPlaybackEntry {
  readonly players: ILoopPlayer[];
}

interface ActiveTrackRecording {
  readonly capture: ActivePcmCapture;
  readonly channelIndex: number;
}

type PreparedLoopReplacementState = 'activated' | 'discarded' | 'prepared';

const LOOP_KEY_SEPARATOR = '\u0000';

function createLoopKey({ trackId, slotId }: LoopSlotAddress): string {
  return `${trackId}${LOOP_KEY_SEPARATOR}${slotId}`;
}

function describeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export class QuantizedLoopRuntime implements ILoopAudioRuntime, ILinearRecordingAudioRuntime {
  readonly #encodeAudioBuffer: (audioBuffer: AudioBuffer) => Blob;
  readonly #liveAudioInput: ILiveAudioInput;
  readonly #listeners = new Set<LoopRuntimeListener>();
  readonly #pcmCapture: ILivePcmCapture;
  readonly #pendingCaptures = new Map<string, PendingLoopCapture>();
  readonly #playback: ILoopPlaybackAdapter;
  #playbackEntries = new Map<string, LoopPlaybackEntry>();
  #revision = 0;
  #inputConnection: ILiveAudioInputConnection | null = null;
  #linearRecordingCaptures = new Map<string, ActiveTrackRecording>();
  #linearRecordingStopPromise: Promise<readonly LinearRecordingTrackResult[]> | null = null;
  #monitorDestination: AudioNode | null = null;

  constructor(options: QuantizedLoopRuntimeOptions) {
    this.#encodeAudioBuffer = options.encodeAudioBuffer ?? encodeAudioBufferToWav;
    this.#liveAudioInput = options.liveAudioInput;
    this.#pcmCapture = options.pcmCapture;
    this.#playback = options.playback;
  }

  async startRecording(request: StartLinearRecordingRuntimeRequest): Promise<void> {
    if (this.#linearRecordingCaptures.size > 0) {
      throw new Error('이미 선형 녹음 캡처가 진행 중입니다.');
    }
    if (!Number.isFinite(request.startDelaySeconds) || request.startDelaySeconds < 0) {
      throw new RangeError('녹음 시작 지연은 0 이상의 유한한 값이어야 합니다.');
    }

    if (request.assignments.length === 0) {
      throw new Error('녹음할 Track 입력 Route가 없습니다.');
    }

    await this.#playback.prepare();
    const connection = await this.#ensureInputConnection();
    const startedTrackIds = new Set<string>();
    try {
      for (const assignment of request.assignments) {
        if (!Number.isInteger(assignment.channelIndex) || assignment.channelIndex < 0) {
          throw new RangeError(`입력 채널 index가 유효하지 않습니다: ${assignment.channelIndex}`);
        }
        if (assignment.deviceId !== null && assignment.deviceId !== connection.deviceId) {
          throw new Error(`선택하지 않은 입력 장치는 녹음할 수 없습니다: ${assignment.deviceId}`);
        }
        const capture = await this.#pcmCapture.start({
          audioContext: this.#playback.getAudioContext(),
          onStarted: () => {
            startedTrackIds.add(assignment.trackId);
            if (startedTrackIds.size === request.assignments.length) {
              request.onStarted();
            }
          },
          startTimeSeconds: this.#playback.getContextTimeSeconds() + request.startDelaySeconds,
          stream: connection.stream,
          workletRuntime: this.#playback,
        });
        this.#linearRecordingCaptures.set(assignment.trackId, { capture, channelIndex: assignment.channelIndex });
      }
    } catch (cause) {
      this.cancelRecording();
      throw cause;
    }
  }

  stopRecording(): Promise<readonly LinearRecordingTrackResult[]> {
    if (this.#linearRecordingCaptures.size === 0) {
      return Promise.reject(new Error('중지할 선형 녹음 캡처가 없습니다.'));
    }
    this.#linearRecordingStopPromise ??= this.#completeLinearRecordings();
    return this.#linearRecordingStopPromise;
  }

  cancelRecording(): void {
    const captures = [...this.#linearRecordingCaptures.values()];
    this.#linearRecordingCaptures.clear();
    this.#linearRecordingStopPromise = null;
    captures.forEach(({ capture }) => capture.cancel());
  }

  async #completeLinearRecordings(): Promise<readonly LinearRecordingTrackResult[]> {
    const recordings = [...this.#linearRecordingCaptures.entries()];
    try {
      return Promise.all(
        recordings.map(async ([trackId, recording]): Promise<LinearRecordingTrackResult> => {
          try {
            const capture = await this.#completeTrackRecording(recording);
            return { capture, status: 'success', trackId };
          } catch (cause) {
            return { cause, status: 'failure', trackId };
          }
        })
      );
    } finally {
      this.#linearRecordingCaptures.clear();
      this.#linearRecordingStopPromise = null;
    }
  }

  async #completeTrackRecording(recording: ActiveTrackRecording): Promise<LinearRecordingCapture> {
    const capturedPcm = await recording.capture.stop();
    const selectedChannel = capturedPcm.channels[recording.channelIndex];
    if (!selectedChannel) {
      throw new RangeError(`녹음 입력에 채널 ${recording.channelIndex}이 없습니다.`);
    }
    const audioBuffer = this.#playback.createAudioBuffer({
      channels: [selectedChannel],
      sampleRate: capturedPcm.sampleRate,
    });
    return {
      blob: this.#encodeAudioBuffer(audioBuffer),
      durationSeconds: selectedChannel.length / capturedPcm.sampleRate,
      sampleRate: capturedPcm.sampleRate,
    };
  }

  async arm(request: ArmLoopRuntimeRequest): Promise<void> {
    await this.#scheduleCapture(request, 'initial');
  }

  async overdub(request: ArmLoopRuntimeRequest): Promise<void> {
    this.#getPlaybackEntry(request);
    await this.#scheduleCapture(request, 'overdub');
  }

  async #scheduleCapture(request: ArmLoopRuntimeRequest, captureMode: LoopCaptureMode): Promise<void> {
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
      workletRuntime: this.#playback,
    });

    const pendingCapture = {
      captureMode,
      destination: request.destination,
      durationSeconds,
      quantizationBars: request.quantizationBars,
      recordedTempoBpm: request.tempoBpm,
      session,
    };
    this.#pendingCaptures.set(key, pendingCapture);
    this.#revision += 1;
    this.#emit({ ...address, scheduledTimeSeconds: boundaryTimeSeconds, state: 'armed', type: 'STATE_CHANGED' });
    void session.completion
      .then(capturedPcm => this.#completeCapture(address, pendingCapture, capturedPcm))
      .catch(error => {
        if (this.#pendingCaptures.get(key) !== pendingCapture) {
          return;
        }
        this.#pendingCaptures.delete(key);
        this.#revision += 1;
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
    this.#revision += 1;
    pendingCapture.session.cancel();
    const state = pendingCapture.captureMode === 'overdub' ? 'playing' : 'empty';
    this.#emit({ ...address, state, type: 'STATE_CHANGED' });
  }

  clear(address: LoopSlotAddress): void {
    this.cancel(address);
    const key = createLoopKey(address);
    const entry = this.#playbackEntries.get(key);
    entry?.players.forEach(player => player.dispose());
    if (this.#playbackEntries.delete(key)) {
      this.#revision += 1;
    }
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
    const audioBuffer = await this.#loadAudioBuffer(request.url);
    this.#appendPlayer(request, audioBuffer);
    this.#emit({ ...request, state: 'stopped', type: 'STATE_CHANGED' });
  }

  listInputDevices() {
    return this.#liveAudioInput.listDevices();
  }

  async prepareReplacement(requests: readonly LoadLoopRuntimeRequest[]): Promise<IPreparedLoopRuntimeReplacement> {
    if (this.#pendingCaptures.size > 0) {
      throw new Error('녹음 대기 또는 녹음 중에는 프로젝트 루프를 교체할 수 없습니다.');
    }
    const expectedRevision = this.#revision;
    const preparedEntries = new Map<string, LoopPlaybackEntry>();

    try {
      for (const request of requests) {
        const key = createLoopKey(request);
        const audioBuffer = await this.#loadAudioBuffer(request.url);
        const player = this.#playback.createPlayer({ audioBuffer, destination: request.destination });
        const entry = preparedEntries.get(key);
        if (entry) {
          entry.players.push(player);
        } else {
          preparedEntries.set(key, { players: [player] });
        }
      }
    } catch (cause) {
      this.#disposePlaybackEntries(preparedEntries);
      throw cause;
    }

    return this.#createPreparedReplacement({ expectedRevision, preparedEntries });
  }

  async setInputDevice(deviceId: string | null): Promise<string | null> {
    const nextConnection = await this.#liveAudioInput.open(deviceId === null ? {} : { deviceId });
    const previousConnection = this.#inputConnection;
    try {
      this.#playback.setMonitoring({ destination: this.#monitorDestination, stream: nextConnection.stream });
    } catch (error) {
      nextConnection.close();
      throw error;
    }
    this.#inputConnection = nextConnection;
    previousConnection?.close();
    return nextConnection.deviceId;
  }

  readInputMeterFrame() {
    return this.#playback.readInputMeterFrame();
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
    const contextTimeSeconds = this.#toContextTime(boundaryTimeSeconds);
    entry.players.forEach(player => player.stopAt(contextTimeSeconds));
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
    const contextTimeSeconds = this.#toContextTime(boundaryTimeSeconds);
    entry.players.forEach(player => player.startAt(contextTimeSeconds));
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
    const player =
      pendingCapture.captureMode === 'initial'
        ? this.#replacePlayers({ ...address, destination: pendingCapture.destination }, audioBuffer)
        : this.#appendPlayer({ ...address, destination: pendingCapture.destination }, audioBuffer);
    const nextBoundaryTimeSeconds = this.#resolveBoundaryTime({
      ...address,
      quantizationBars: pendingCapture.quantizationBars,
      tempoBpm: pendingCapture.recordedTempoBpm,
    });
    player.startAt(this.#toContextTime(nextBoundaryTimeSeconds));
    this.#emit({
      ...address,
      blob,
      captureMode: pendingCapture.captureMode,
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

  #replacePlayers(
    request: LoopSlotAddress & { readonly destination: AudioNode },
    audioBuffer: AudioBuffer
  ): ILoopPlayer {
    const key = createLoopKey(request);
    this.#playbackEntries.get(key)?.players.forEach(player => player.dispose());
    const player = this.#playback.createPlayer({ audioBuffer, destination: request.destination });
    this.#playbackEntries.set(key, { players: [player] });
    this.#revision += 1;
    return player;
  }

  #appendPlayer(request: LoopSlotAddress & { readonly destination: AudioNode }, audioBuffer: AudioBuffer): ILoopPlayer {
    // 오버더빙은 원본 Player를 교체하지 않아 각 녹음 레이어를 별도 Source로 보존한다.
    const key = createLoopKey(request);
    const player = this.#playback.createPlayer({ audioBuffer, destination: request.destination });
    const entry = this.#playbackEntries.get(key);
    if (entry) {
      entry.players.push(player);
    } else {
      this.#playbackEntries.set(key, { players: [player] });
    }
    this.#revision += 1;
    return player;
  }

  async #loadAudioBuffer(url: string): Promise<AudioBuffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`루프 오디오를 불러오지 못했습니다: ${response.status}`);
    }
    return this.#playback.getAudioContext().decodeAudioData(await response.arrayBuffer());
  }

  #createPreparedReplacement({
    expectedRevision,
    preparedEntries,
  }: {
    readonly expectedRevision: number;
    readonly preparedEntries: Map<string, LoopPlaybackEntry>;
  }): IPreparedLoopRuntimeReplacement {
    let state: PreparedLoopReplacementState = 'prepared';
    let retiredRuntime: IRetiredLoopRuntime | null = null;

    const assertActivatable = (): void => {
      if (state === 'activated') {
        return;
      }
      if (state === 'discarded' || this.#revision !== expectedRevision || this.#pendingCaptures.size > 0) {
        throw new Error('준비 중 활성 루프 상태가 변경되었습니다.');
      }
    };

    return {
      assertActivatable,
      activate: () => {
        if (retiredRuntime) {
          return retiredRuntime;
        }
        assertActivatable();
        const retiredEntries = this.#playbackEntries;
        this.#playbackEntries = preparedEntries;
        this.#revision += 1;
        state = 'activated';
        retiredRuntime = this.#createRetiredRuntime(retiredEntries);
        return retiredRuntime;
      },
      discard: () => {
        if (state === 'activated') {
          return COMPLETE_RESOURCE_CLEANUP;
        }
        state = 'discarded';
        return this.#disposePlaybackEntries(preparedEntries);
      },
    };
  }

  #createRetiredRuntime(entries: Map<string, LoopPlaybackEntry>): IRetiredLoopRuntime {
    return { dispose: () => this.#disposePlaybackEntries(entries) };
  }

  #disposePlaybackEntries(entries: Map<string, LoopPlaybackEntry>): ResourceCleanupResult {
    let failedResourceCount = 0;
    entries.forEach((entry, key) => {
      const failedPlayers = entry.players.filter(player => {
        try {
          player.dispose();
          return false;
        } catch {
          failedResourceCount += 1;
          return true;
        }
      });
      if (failedPlayers.length === 0) {
        entries.delete(key);
      } else {
        entry.players.splice(0, entry.players.length, ...failedPlayers);
      }
    });

    return failedResourceCount === 0 ? COMPLETE_RESOURCE_CLEANUP : { failedResourceCount, isComplete: false };
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
