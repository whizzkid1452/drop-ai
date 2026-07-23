import * as Tone from 'tone';
import { insertArrayEntry, moveArrayEntry } from '../shared/array-order';
import { COMPLETE_RESOURCE_CLEANUP, type ResourceCleanupResult } from '../shared/types/resource-cleanup';
import { startPlayer } from './config/player-config';
import { encodeAudioBufferToWav } from './encoders/wav-encoder';
import { AudioEngineError, AudioEngineErrorCode, ERROR_MESSAGES } from './errors';
import type {
  AudioProjectGraphPluginInstance,
  ExportRequest,
  ExportTrack,
  IAudioEngine,
  InstallAudioPluginRequest,
  MoveAudioPluginRequest,
  IPreparedAudioProjectGraph,
  IRetiredAudioProjectGraph,
  PrepareAudioProjectGraphRequest,
  RegionData,
  ReplaceRegionRequest,
  RescheduleRegionRequest,
  SetAudioPluginEnabledRequest,
  SetAudioPluginParameterRequest,
} from './i-audio-engine';
import type { IAudioPluginRuntime, IAudioPluginRuntimeFactory } from './plugins/audio-plugin-runtime';
import { AudioPluginRuntimeError } from './plugins/errors';
import { RegionRenderer, type RegionRenderParams } from './renderers/region-renderer';

interface RegionPlayerEntry {
  player: Tone.Player;
  regionData: RegionData;
  revision: number;
}

interface CreateRegionEntriesRequest {
  input: Tone.Gain;
  regions: RegionData[];
}

interface AudioProjectGraphState {
  readonly output: Tone.Gain;
  readonly trackInputs: Map<string, Tone.Gain>;
  readonly channels: Map<string, Tone.Channel>;
  readonly desiredTrackVolumes: Map<string, number>;
  readonly mutedTrackIds: Set<string>;
  readonly soloedTrackIds: Set<string>;
  readonly players: Map<string, Map<string, RegionPlayerEntry>>;
  readonly pluginRuntimes: Map<string, IAudioPluginRuntime[]>;
  readonly disabledPluginInstanceIds: Map<string, Set<string>>;
}

interface AudioEngineOptions {
  readonly pluginRuntimeFactories?: readonly IAudioPluginRuntimeFactory[];
}

interface CreatePreparedPluginRuntimesRequest {
  readonly trackId: string;
  readonly pluginInstances: readonly AudioProjectGraphPluginInstance[];
}

interface ValidatePluginTargetIndexRequest extends MoveAudioPluginRequest {
  readonly maximumIndex: number;
}

interface ConnectPreparedPluginChainRequest {
  readonly input: Tone.Gain;
  readonly channel: Tone.Channel;
  readonly runtimes: readonly IAudioPluginRuntime[];
  readonly trackId: string;
}

interface ReplacePluginChainConnectionsRequest {
  readonly trackId: string;
  readonly input: Tone.Gain;
  readonly channel: Tone.Channel;
  readonly previousRuntimes: readonly IAudioPluginRuntime[];
  readonly nextRuntimes: readonly IAudioPluginRuntime[];
  readonly runtimesToDisposeOnRollback: readonly IAudioPluginRuntime[];
}

interface PluginChainRecoveryState {
  readonly trackId: string;
  readonly input: Tone.Gain;
  readonly channel: Tone.Channel;
  readonly targetRuntimes: readonly IAudioPluginRuntime[];
  readonly involvedRuntimes: readonly IAudioPluginRuntime[];
  readonly runtimesToDispose: readonly IAudioPluginRuntime[];
}

interface RebuildPluginChainConnectionsRequest {
  readonly input: Tone.Gain;
  readonly channel: Tone.Channel;
  readonly targetRuntimes: readonly IAudioPluginRuntime[];
  readonly involvedRuntimes: readonly IAudioPluginRuntime[];
}

interface TransportSnapshot {
  readonly seconds: number;
  readonly state: 'paused' | 'started' | 'stopped';
}

interface GraphActivationRollbackResult {
  readonly compensationFailures: string[];
  readonly isRuntimeRecoveryPending: boolean;
}

type PreparedGraphState = 'activated' | 'discarded' | 'prepared';

export class AudioEngine implements IAudioEngine {
  private output: Tone.Gain;
  private trackInputs: Map<string, Tone.Gain> = new Map();
  private channels: Map<string, Tone.Channel> = new Map();
  private desiredTrackVolumes: Map<string, number> = new Map();
  private mutedTrackIds: Set<string> = new Set();
  private soloedTrackIds: Set<string> = new Set();
  private players: Map<string, Map<string, RegionPlayerEntry>> = new Map();
  private pluginRuntimes: Map<string, IAudioPluginRuntime[]> = new Map();
  private disabledPluginInstanceIds: Map<string, Set<string>> = new Map();
  private readonly pluginRuntimeFactories: ReadonlyMap<string, IAudioPluginRuntimeFactory>;
  private graphRevision = 0;
  private readonly mutedOutputs = new WeakSet<Tone.Gain>();
  private readonly disconnectedOutputs = new WeakSet<Tone.Gain>();
  private readonly disposedOutputs = new WeakSet<Tone.Gain>();
  private readonly disconnectedTrackInputs = new WeakSet<Tone.Gain>();
  private readonly disposedTrackInputs = new WeakSet<Tone.Gain>();
  private readonly disconnectedChannels = new WeakSet<Tone.Channel>();
  private readonly disposedChannels = new WeakSet<Tone.Channel>();
  private readonly unsyncedPlayers = new WeakSet<Tone.Player>();
  private readonly stoppedPlayers = new WeakSet<Tone.Player>();
  private readonly disconnectedPlayers = new WeakSet<Tone.Player>();
  private readonly disposedPlayers = new WeakSet<Tone.Player>();
  private readonly disconnectedPluginRuntimes = new WeakSet<IAudioPluginRuntime>();
  private readonly disposedPluginRuntimes = new WeakSet<IAudioPluginRuntime>();
  private readonly pendingGraphCleanup = new Set<AudioProjectGraphState>();
  private readonly pendingChannelCleanup = new Set<Tone.Channel>();
  private readonly pendingOutputCleanup = new Set<Tone.Gain>();
  private readonly pendingTrackInputCleanup = new Set<Tone.Gain>();
  private readonly pendingPlayerCleanup = new Set<Tone.Player>();
  private readonly pendingPluginRuntimeCleanup = new Set<IAudioPluginRuntime>();
  private readonly pendingOutputStateRecovery = new Map<Tone.Gain, boolean>();
  private readonly pendingPluginChainRecovery = new Map<string, PluginChainRecoveryState>();
  private pendingTransportRecovery: TransportSnapshot | null = null;

  constructor({ pluginRuntimeFactories = [] }: AudioEngineOptions = {}) {
    this.pluginRuntimeFactories = createPluginRuntimeFactoryMap(pluginRuntimeFactories);
    this.output = this.createGraphOutput(1);
  }

  async play(): Promise<void> {
    this.ensureRuntimeReady();
    this.retryPendingCleanup();
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }
    await Tone.getTransport().start();
  }

  pause(): void {
    this.ensureRuntimeReady();
    Tone.getTransport().pause();
  }

  stop(): void {
    this.ensureRuntimeReady();
    Tone.getTransport().stop();
  }

  setTime(time: number): void {
    this.ensureRuntimeReady();
    Tone.getTransport().seconds = time;
  }

  getCurrentTime(): number {
    this.ensureRuntimeReady();
    return Tone.getTransport().seconds;
  }

  async addTrack(trackId: string): Promise<void> {
    this.ensureRuntimeReady();
    console.log(`[AudioEngine] Adding track: ${trackId}`);
    this.getOrInitTrackNodes(trackId);
  }

  removeTrack(trackId: string): void {
    this.ensureRuntimeReady();
    const hadTrack = this.trackInputs.has(trackId) || this.channels.has(trackId) || this.players.has(trackId);
    if (hadTrack) {
      this.graphRevision += 1;
    }
    const trackPlayers = this.players.get(trackId);
    trackPlayers?.forEach(entry => this.disposePlayer(entry.player));
    this.players.delete(trackId);

    this.pluginRuntimes
      .get(trackId)
      ?.forEach(runtime => this.disposePluginRuntimeSafely(runtime, '제거한 Track의 Plugin 정리에 실패했습니다.'));
    this.pluginRuntimes.delete(trackId);
    this.disabledPluginInstanceIds.delete(trackId);

    const input = this.trackInputs.get(trackId);
    if (input) {
      this.disposeTrackInput(input);
    }
    this.trackInputs.delete(trackId);

    const channel = this.channels.get(trackId);
    if (channel) {
      this.disposeChannel(channel);
    }
    this.channels.delete(trackId);
    this.desiredTrackVolumes.delete(trackId);
    this.mutedTrackIds.delete(trackId);
    this.soloedTrackIds.delete(trackId);
    this.applyGraphAudibility(this.captureActiveGraph());
  }

  setTrackVolume(trackId: string, volume: number): void {
    this.ensureRuntimeReady();
    const channel = this.getOrInitChannel(trackId);
    this.graphRevision += 1;
    this.desiredTrackVolumes.set(trackId, volume);
    if (this.isTrackMutedInGraph(this.captureActiveGraph(), trackId)) {
      return;
    }

    const volumeInDb = Tone.gainToDb(volume);
    channel.volume.rampTo(volumeInDb, 0.1);
  }

  setTrackPan(trackId: string, pan: number): void {
    this.ensureRuntimeReady();
    const channel = this.getOrInitChannel(trackId);
    this.graphRevision += 1;
    channel.pan.rampTo(pan, 0.1);
  }

  setTrackMute(trackId: string, muted: boolean): void {
    this.ensureRuntimeReady();
    this.getExistingChannel(trackId);
    this.graphRevision += 1;
    if (muted) {
      this.mutedTrackIds.add(trackId);
    } else {
      this.mutedTrackIds.delete(trackId);
    }

    this.applyGraphAudibility(this.captureActiveGraph());
  }

  setTrackSolo(trackId: string, soloed: boolean): void {
    this.ensureRuntimeReady();
    this.getExistingChannel(trackId);
    this.graphRevision += 1;
    if (soloed) {
      this.soloedTrackIds.add(trackId);
    } else {
      this.soloedTrackIds.delete(trackId);
    }
    this.applyGraphAudibility(this.captureActiveGraph());
  }

  getTrackParams(trackId: string): { volume: number; pan: number } | null {
    this.ensureRuntimeReady();
    const channel = this.channels.get(trackId);
    if (!channel) {
      return null;
    }

    return {
      volume: this.desiredTrackVolumes.get(trackId) ?? Tone.dbToGain(channel.volume.value),
      pan: channel.pan.value,
    };
  }

  installPlugin(request: InstallAudioPluginRequest): void {
    this.ensureRuntimeReady();
    const input = this.getExistingInput(request.trackId);
    const channel = this.getExistingChannel(request.trackId);
    const currentRuntimes = this.getTrackPluginRuntimes(request.trackId);
    if (currentRuntimes.some(runtime => runtime.instanceId === request.instanceId)) {
      throw new AudioEngineError(
        AudioEngineErrorCode.PLUGIN_INSTANCE_ID_CONFLICT,
        ERROR_MESSAGES.PLUGIN_INSTANCE_ID_CONFLICT,
        { instanceId: request.instanceId, trackId: request.trackId }
      );
    }

    const targetIndex = request.targetIndex ?? currentRuntimes.length;
    this.validatePluginTargetIndex({ ...request, targetIndex, maximumIndex: currentRuntimes.length });

    const factory = this.pluginRuntimeFactories.get(request.manifestId);
    if (!factory) {
      throw new AudioEngineError(
        AudioEngineErrorCode.PLUGIN_FACTORY_NOT_FOUND,
        ERROR_MESSAGES.PLUGIN_FACTORY_NOT_FOUND,
        { manifestId: request.manifestId }
      );
    }

    const runtime = this.createPluginRuntime(factory, request);
    const nextRuntimes = insertArrayEntry({ entries: currentRuntimes, entry: runtime, targetIndex });
    const currentDisabledIds = this.getTrackDisabledPluginInstanceIds(request.trackId);
    const nextDisabledIds = new Set(currentDisabledIds);
    if (request.isEnabled === false) {
      nextDisabledIds.add(request.instanceId);
    }
    this.replacePluginChainConnections({
      trackId: request.trackId,
      input,
      channel,
      previousRuntimes: getEnabledPluginRuntimes(currentRuntimes, currentDisabledIds),
      nextRuntimes: getEnabledPluginRuntimes(nextRuntimes, nextDisabledIds),
      runtimesToDisposeOnRollback: [runtime],
    });
    this.pluginRuntimes.set(request.trackId, nextRuntimes);
    this.disabledPluginInstanceIds.set(request.trackId, nextDisabledIds);
    this.graphRevision += 1;
  }

  removePlugin(trackId: string, instanceId: string): void {
    this.ensureRuntimeReady();
    const input = this.getExistingInput(trackId);
    const channel = this.getExistingChannel(trackId);
    const currentRuntimes = this.getTrackPluginRuntimes(trackId);
    const runtimeIndex = currentRuntimes.findIndex(runtime => runtime.instanceId === instanceId);
    if (runtimeIndex < 0) {
      throw new AudioEngineError(
        AudioEngineErrorCode.PLUGIN_INSTANCE_NOT_FOUND,
        ERROR_MESSAGES.PLUGIN_INSTANCE_NOT_FOUND,
        { instanceId, trackId }
      );
    }

    const runtime = currentRuntimes[runtimeIndex];
    const nextRuntimes = currentRuntimes.filter((_, index) => index !== runtimeIndex);
    const currentDisabledIds = this.getTrackDisabledPluginInstanceIds(trackId);
    const nextDisabledIds = new Set(currentDisabledIds);
    nextDisabledIds.delete(instanceId);
    this.replacePluginChainConnections({
      trackId,
      input,
      channel,
      previousRuntimes: getEnabledPluginRuntimes(currentRuntimes, currentDisabledIds),
      nextRuntimes: getEnabledPluginRuntimes(nextRuntimes, nextDisabledIds),
      runtimesToDisposeOnRollback: [],
    });
    this.pluginRuntimes.set(trackId, nextRuntimes);
    this.disabledPluginInstanceIds.set(trackId, nextDisabledIds);
    this.graphRevision += 1;
    if (runtime) {
      this.disposePluginRuntimeSafely(runtime, '제거한 Plugin runtime 정리에 실패했습니다.');
    }
  }

  movePlugin(request: MoveAudioPluginRequest): void {
    this.ensureRuntimeReady();
    const input = this.getExistingInput(request.trackId);
    const channel = this.getExistingChannel(request.trackId);
    const currentRuntimes = this.getTrackPluginRuntimes(request.trackId);
    const sourceIndex = currentRuntimes.findIndex(runtime => runtime.instanceId === request.instanceId);
    if (sourceIndex < 0) {
      throw new AudioEngineError(
        AudioEngineErrorCode.PLUGIN_INSTANCE_NOT_FOUND,
        ERROR_MESSAGES.PLUGIN_INSTANCE_NOT_FOUND,
        { instanceId: request.instanceId, trackId: request.trackId }
      );
    }
    this.validatePluginTargetIndex({ ...request, maximumIndex: currentRuntimes.length - 1 });
    if (sourceIndex === request.targetIndex) {
      return;
    }

    const nextRuntimes = moveArrayEntry({ entries: currentRuntimes, sourceIndex, targetIndex: request.targetIndex });
    const disabledInstanceIds = this.getTrackDisabledPluginInstanceIds(request.trackId);
    this.replacePluginChainConnections({
      trackId: request.trackId,
      input,
      channel,
      previousRuntimes: getEnabledPluginRuntimes(currentRuntimes, disabledInstanceIds),
      nextRuntimes: getEnabledPluginRuntimes(nextRuntimes, disabledInstanceIds),
      runtimesToDisposeOnRollback: [],
    });
    this.pluginRuntimes.set(request.trackId, nextRuntimes);
    this.graphRevision += 1;
  }

  setPluginParameter(request: SetAudioPluginParameterRequest): void {
    this.ensureRuntimeReady();
    const runtime = this.getTrackPluginRuntimes(request.trackId).find(
      candidate => candidate.instanceId === request.instanceId
    );
    if (!runtime) {
      throw new AudioEngineError(
        AudioEngineErrorCode.PLUGIN_INSTANCE_NOT_FOUND,
        ERROR_MESSAGES.PLUGIN_INSTANCE_NOT_FOUND,
        { instanceId: request.instanceId, trackId: request.trackId }
      );
    }

    try {
      runtime.setParameter(request.parameterId, request.value);
    } catch (cause) {
      throw new AudioEngineError(
        AudioEngineErrorCode.PLUGIN_PARAMETER_UPDATE_FAILED,
        ERROR_MESSAGES.PLUGIN_PARAMETER_UPDATE_FAILED,
        {
          cause: this.describeError(cause),
          instanceId: request.instanceId,
          parameterId: request.parameterId,
          runtimeErrorCode: cause instanceof AudioPluginRuntimeError ? cause.code : undefined,
          trackId: request.trackId,
        }
      );
    }
    this.graphRevision += 1;
  }

  setPluginEnabled(request: SetAudioPluginEnabledRequest): void {
    this.ensureRuntimeReady();
    const input = this.getExistingInput(request.trackId);
    const channel = this.getExistingChannel(request.trackId);
    const runtimes = this.getTrackPluginRuntimes(request.trackId);
    if (!runtimes.some(runtime => runtime.instanceId === request.instanceId)) {
      throw new AudioEngineError(
        AudioEngineErrorCode.PLUGIN_INSTANCE_NOT_FOUND,
        ERROR_MESSAGES.PLUGIN_INSTANCE_NOT_FOUND,
        { instanceId: request.instanceId, trackId: request.trackId }
      );
    }

    const currentDisabledIds = this.getTrackDisabledPluginInstanceIds(request.trackId);
    const isCurrentlyEnabled = !currentDisabledIds.has(request.instanceId);
    if (isCurrentlyEnabled === request.isEnabled) {
      return;
    }

    const nextDisabledIds = new Set(currentDisabledIds);
    if (request.isEnabled) {
      nextDisabledIds.delete(request.instanceId);
    } else {
      nextDisabledIds.add(request.instanceId);
    }
    this.replacePluginChainConnections({
      trackId: request.trackId,
      input,
      channel,
      previousRuntimes: getEnabledPluginRuntimes(runtimes, currentDisabledIds),
      nextRuntimes: getEnabledPluginRuntimes(runtimes, nextDisabledIds),
      runtimesToDisposeOnRollback: [],
    });
    this.disabledPluginInstanceIds.set(request.trackId, nextDisabledIds);
    this.graphRevision += 1;
  }

  async addRegion(trackId: string, regionData: RegionData): Promise<void> {
    this.ensureRuntimeReady();
    const { input } = this.getOrInitTrackNodes(trackId);
    const trackPlayers = this.players.get(trackId);
    if (!trackPlayers) {
      throw this.createRegionStateChangedError({ trackId, regionId: regionData.id });
    }
    if (trackPlayers.has(regionData.id)) {
      throw this.createRegionIdConflictError({ trackId, regionId: regionData.id });
    }
    this.graphRevision += 1;

    const [entry] = await this.createScheduledRegionEntries({ input, regions: [regionData] });
    this.ensureRuntimeReadyOrCleanupEntries(entry ? [entry] : []);
    if (!entry) {
      return;
    }
    if (this.players.get(trackId) !== trackPlayers) {
      this.cleanupRegionEntries([entry]);
      throw this.createRegionStateChangedError({ trackId, regionId: regionData.id });
    }
    if (trackPlayers.has(regionData.id)) {
      this.cleanupRegionEntries([entry]);
      throw this.createRegionIdConflictError({ trackId, regionId: regionData.id });
    }

    trackPlayers.set(entry.regionData.id, entry);
    this.graphRevision += 1;
  }

  removeRegion(trackId: string, regionId: string): void {
    this.ensureRuntimeReady();
    const trackPlayers = this.players.get(trackId);
    const entry = trackPlayers?.get(regionId);
    if (!entry) {
      return;
    }

    this.graphRevision += 1;
    this.disposePlayer(entry.player);
    trackPlayers?.delete(regionId);
  }

  rescheduleRegion(request: RescheduleRegionRequest): void {
    this.ensureRuntimeReady();
    const trackPlayers = this.players.get(request.trackId);
    const entry = this.getRegionEntry(request);
    const input = this.getExistingInput(request.trackId);
    this.graphRevision += 1;
    const nextRegionData = { ...entry.regionData, startTime: request.startTime };
    const nextEntry: RegionPlayerEntry = {
      player: new Tone.Player({ url: entry.player.buffer, loop: false }).connect(input),
      regionData: this.cloneRegionData(nextRegionData),
      revision: entry.revision + 1,
    };

    try {
      this.schedulePlayer(nextEntry.player, nextEntry.regionData);
    } catch (error) {
      this.cleanupRegionEntries([nextEntry]);
      throw new AudioEngineError(AudioEngineErrorCode.REGION_SCHEDULE_FAILED, ERROR_MESSAGES.REGION_SCHEDULE_FAILED, {
        cause: this.describeError(error),
      });
    }

    this.disposePlayer(entry.player);
    trackPlayers?.set(request.regionId, nextEntry);
  }

  async replaceRegion(request: ReplaceRegionRequest): Promise<void> {
    this.ensureRuntimeReady();
    const trackPlayers = this.players.get(request.trackId);
    const originalEntry = trackPlayers?.get(request.regionId);
    if (!trackPlayers || !originalEntry) {
      throw this.createRegionNotFoundError(request);
    }

    const originalRevision = originalEntry.revision;
    this.validateReplacementIds(trackPlayers, request);
    const input = this.getExistingInput(request.trackId);
    this.graphRevision += 1;
    const replacementEntries = await this.createScheduledRegionEntries({
      input,
      regions: request.replacements,
    });
    this.ensureRuntimeReadyOrCleanupEntries(replacementEntries);

    const currentEntry = trackPlayers.get(request.regionId);
    const stateChanged =
      this.players.get(request.trackId) !== trackPlayers ||
      currentEntry !== originalEntry ||
      currentEntry?.revision !== originalRevision;
    if (stateChanged) {
      this.cleanupRegionEntries(replacementEntries);
      throw this.createRegionStateChangedError(request);
    }

    try {
      this.validateReplacementIds(trackPlayers, request);
    } catch (error) {
      this.cleanupRegionEntries(replacementEntries);
      throw error;
    }

    this.disposePlayer(originalEntry.player);
    trackPlayers.delete(request.regionId);
    replacementEntries.forEach(entry => trackPlayers.set(entry.regionData.id, entry));
    this.graphRevision += 1;
  }

  async prepareProjectGraph({ tracks }: PrepareAudioProjectGraphRequest): Promise<IPreparedAudioProjectGraph> {
    this.ensureRuntimeReady();
    this.retryPendingCleanup();
    const expectedRevision = this.graphRevision;
    const preparedGraph = await this.createPreparedProjectGraph(tracks);
    let retiredGraph: IRetiredAudioProjectGraph | undefined;
    let state: PreparedGraphState = 'prepared';

    const assertActivatable = (): void => {
      if (state === 'activated') {
        return;
      }

      if (state === 'discarded' || this.graphRevision !== expectedRevision) {
        throw new AudioEngineError(AudioEngineErrorCode.ACTIVE_GRAPH_CHANGED, ERROR_MESSAGES.ACTIVE_GRAPH_CHANGED, {
          actualRevision: this.graphRevision,
          expectedRevision,
        });
      }
    };

    return {
      assertActivatable,
      activate: () => {
        if (retiredGraph) {
          return retiredGraph;
        }

        assertActivatable();
        let previousGraph: AudioProjectGraphState;
        try {
          previousGraph = this.activatePreparedGraph(preparedGraph);
        } catch (cause) {
          state = 'discarded';
          this.disposeGraph(preparedGraph, '활성화에 실패한 프로젝트 그래프 정리에 실패했습니다.');
          throw cause;
        }
        this.graphRevision += 1;
        state = 'activated';
        retiredGraph = this.createRetiredGraph(previousGraph);
        return retiredGraph;
      },
      discard: () => {
        if (state === 'activated') {
          return COMPLETE_RESOURCE_CLEANUP;
        }

        state = 'discarded';
        return this.disposeGraph(preparedGraph, '준비한 프로젝트 그래프 정리에 실패했습니다.');
      },
    };
  }

  async exportProject(request: ExportRequest): Promise<Blob> {
    const duration = request.range.endTime - request.range.startTime;
    if (duration <= 0) {
      throw new AudioEngineError(AudioEngineErrorCode.EXPORT_ZERO_DURATION, ERROR_MESSAGES.EXPORT_ZERO_DURATION);
    }
    if (request.tracks.length === 0) {
      throw new AudioEngineError(AudioEngineErrorCode.EXPORT_NO_TRACKS, ERROR_MESSAGES.EXPORT_NO_TRACKS);
    }

    try {
      const renderedBuffer = await Tone.Offline(
        async () => this.scheduleExport(request),
        duration,
        2,
        request.sampleRate
      );
      const audioBuffer = renderedBuffer.get();
      if (!audioBuffer) {
        throw new AudioEngineError(AudioEngineErrorCode.RENDER_FAILED, ERROR_MESSAGES.RENDER_FAILED);
      }
      return encodeAudioBufferToWav(audioBuffer);
    } catch (error) {
      if (error instanceof AudioEngineError) {
        throw error;
      }
      throw new AudioEngineError(AudioEngineErrorCode.EXPORT_FAILED, ERROR_MESSAGES.EXPORT_FAILED, {
        cause: this.describeError(error),
      });
    }
  }

  private getOrInitChannel(trackId: string): Tone.Channel {
    return this.getOrInitTrackNodes(trackId).channel;
  }

  private createPluginRuntime(
    factory: IAudioPluginRuntimeFactory,
    request: InstallAudioPluginRequest
  ): IAudioPluginRuntime {
    try {
      return factory.create({ instanceId: request.instanceId, parameterValues: request.parameterValues });
    } catch (cause) {
      throw new AudioEngineError(
        AudioEngineErrorCode.PLUGIN_RUNTIME_CREATE_FAILED,
        ERROR_MESSAGES.PLUGIN_RUNTIME_CREATE_FAILED,
        {
          cause: this.describeError(cause),
          instanceId: request.instanceId,
          manifestId: request.manifestId,
          runtimeErrorCode: cause instanceof AudioPluginRuntimeError ? cause.code : undefined,
        }
      );
    }
  }

  private createPreparedPluginRuntimes({
    trackId,
    pluginInstances,
  }: CreatePreparedPluginRuntimesRequest): IAudioPluginRuntime[] {
    const instanceIds = new Set<string>();
    const runtimes: IAudioPluginRuntime[] = [];

    try {
      for (const instance of pluginInstances) {
        if (instanceIds.has(instance.instanceId)) {
          throw new AudioEngineError(
            AudioEngineErrorCode.PLUGIN_INSTANCE_ID_CONFLICT,
            ERROR_MESSAGES.PLUGIN_INSTANCE_ID_CONFLICT,
            { instanceId: instance.instanceId, trackId }
          );
        }
        instanceIds.add(instance.instanceId);

        const factory = this.pluginRuntimeFactories.get(instance.manifestId);
        if (!factory) {
          throw new AudioEngineError(
            AudioEngineErrorCode.PLUGIN_FACTORY_NOT_FOUND,
            ERROR_MESSAGES.PLUGIN_FACTORY_NOT_FOUND,
            { manifestId: instance.manifestId }
          );
        }

        runtimes.push(
          this.createPluginRuntime(factory, {
            trackId,
            instanceId: instance.instanceId,
            manifestId: instance.manifestId,
            parameterValues: instance.parameterValues,
          })
        );
      }

      return runtimes;
    } catch (error) {
      runtimes.forEach(runtime =>
        this.disposePluginRuntimeSafely(runtime, '프로젝트 준비 중 만든 Plugin runtime 정리에 실패했습니다.')
      );
      throw error;
    }
  }

  private connectPreparedPluginChain({ input, channel, runtimes, trackId }: ConnectPreparedPluginChainRequest): void {
    if (runtimes.length === 0) {
      input.connect(channel);
      return;
    }

    try {
      this.rebuildPluginChainConnections({
        input,
        channel,
        targetRuntimes: runtimes,
        involvedRuntimes: runtimes,
      });
    } catch (cause) {
      throw new AudioEngineError(
        AudioEngineErrorCode.PLUGIN_CHAIN_UPDATE_FAILED,
        ERROR_MESSAGES.PLUGIN_CHAIN_UPDATE_FAILED,
        { cause: this.describeError(cause), trackId }
      );
    }
  }

  private replacePluginChainConnections({
    trackId,
    input,
    channel,
    previousRuntimes,
    nextRuntimes,
    runtimesToDisposeOnRollback,
  }: ReplacePluginChainConnectionsRequest): void {
    const involvedRuntimes = getUniquePluginRuntimes([...previousRuntimes, ...nextRuntimes]);
    try {
      this.rebuildPluginChainConnections({ input, channel, targetRuntimes: nextRuntimes, involvedRuntimes });
      return;
    } catch (cause) {
      const recoveryState: PluginChainRecoveryState = {
        trackId,
        input,
        channel,
        targetRuntimes: previousRuntimes,
        involvedRuntimes,
        runtimesToDispose: runtimesToDisposeOnRollback,
      };
      const recoveryFailure = this.tryPluginChainRecovery(recoveryState);
      throw new AudioEngineError(
        AudioEngineErrorCode.PLUGIN_CHAIN_UPDATE_FAILED,
        ERROR_MESSAGES.PLUGIN_CHAIN_UPDATE_FAILED,
        {
          cause: this.describeError(cause),
          isRuntimeRecoveryPending: recoveryFailure !== null,
          recoveryFailure,
          trackId,
        }
      );
    }
  }

  private rebuildPluginChainConnections({
    input,
    channel,
    targetRuntimes,
    involvedRuntimes,
  }: RebuildPluginChainConnectionsRequest): void {
    input.disconnect();
    involvedRuntimes.forEach(runtime => runtime.disconnect());
    const firstRuntime = targetRuntimes[0];
    if (!firstRuntime) {
      input.connect(channel);
      return;
    }

    input.connect(firstRuntime.inputNode);
    targetRuntimes.forEach((runtime, index) => {
      const nextRuntime = targetRuntimes[index + 1];
      runtime.connect(nextRuntime?.inputNode ?? channel);
    });
  }

  private tryPluginChainRecovery(recoveryState: PluginChainRecoveryState): string | null {
    try {
      this.rebuildPluginChainConnections(recoveryState);
      this.pendingPluginChainRecovery.delete(recoveryState.trackId);
      recoveryState.runtimesToDispose.forEach(runtime =>
        this.disposePluginRuntimeSafely(runtime, '복원 뒤 Plugin runtime 정리에 실패했습니다.')
      );
      return null;
    } catch (error) {
      this.pendingPluginChainRecovery.set(recoveryState.trackId, recoveryState);
      return this.describeError(error);
    }
  }

  private getOrInitTrackNodes(trackId: string): { readonly input: Tone.Gain; readonly channel: Tone.Channel } {
    const currentInput = this.trackInputs.get(trackId);
    const currentChannel = this.channels.get(trackId);
    if (currentInput && currentChannel) {
      return { input: currentInput, channel: currentChannel };
    }
    if (currentInput || currentChannel) {
      throw new AudioEngineError(AudioEngineErrorCode.TRACK_INIT_FAILED, ERROR_MESSAGES.TRACK_INIT_FAILED, {
        reason: 'TRACK_NODE_STATE_INCONSISTENT',
        trackId,
      });
    }

    const input = new Tone.Gain({ gain: 1 });
    const channel = new Tone.Channel({
      volume: 0,
      pan: 0,
    });

    try {
      input.connect(channel);
      channel.connect(this.output);
    } catch (cause) {
      this.disposeTrackInputSafely(input, '연결에 실패한 Track input 정리에 실패했습니다.');
      this.disposeChannelSafely(channel, '연결에 실패한 Track Channel 정리에 실패했습니다.');
      throw new AudioEngineError(AudioEngineErrorCode.TRACK_INIT_FAILED, ERROR_MESSAGES.TRACK_INIT_FAILED, {
        cause: this.describeError(cause),
        trackId,
      });
    }

    this.trackInputs.set(trackId, input);
    this.channels.set(trackId, channel);
    this.desiredTrackVolumes.set(trackId, 1);
    this.players.set(trackId, new Map());
    this.pluginRuntimes.set(trackId, []);
    this.disabledPluginInstanceIds.set(trackId, new Set());
    this.graphRevision += 1;
    this.applyGraphAudibility(this.captureActiveGraph());
    return { input, channel };
  }

  private async createPreparedProjectGraph(
    tracks: PrepareAudioProjectGraphRequest['tracks']
  ): Promise<AudioProjectGraphState> {
    const graph = this.createEmptyGraph(0);

    try {
      for (const track of tracks) {
        if (graph.channels.has(track.id)) {
          throw new AudioEngineError(AudioEngineErrorCode.TRACK_INIT_FAILED, ERROR_MESSAGES.TRACK_INIT_FAILED, {
            reason: 'TRACK_ID_CONFLICT',
            trackId: track.id,
          });
        }

        this.assertUniquePreparedRegionIds(track.id, track.regions);
        const input = new Tone.Gain({ gain: 1 });
        const channel = new Tone.Channel({
          volume: Tone.gainToDb(track.volume),
          pan: track.pan,
        });
        graph.trackInputs.set(track.id, input);
        graph.channels.set(track.id, channel);
        const pluginRuntimes = this.createPreparedPluginRuntimes({
          trackId: track.id,
          pluginInstances: track.pluginInstances,
        });
        graph.pluginRuntimes.set(track.id, pluginRuntimes);
        const disabledPluginInstanceIds = new Set(
          track.pluginInstances.filter(instance => !instance.isEnabled).map(instance => instance.instanceId)
        );
        graph.disabledPluginInstanceIds.set(track.id, disabledPluginInstanceIds);
        this.connectPreparedPluginChain({
          input,
          channel,
          runtimes: getEnabledPluginRuntimes(pluginRuntimes, disabledPluginInstanceIds),
          trackId: track.id,
        });
        channel.connect(graph.output);
        channel.volume.value = Tone.gainToDb(track.volume);
        channel.pan.value = track.pan;
        graph.desiredTrackVolumes.set(track.id, track.volume);
        graph.players.set(track.id, new Map());
        if (track.isMuted) {
          graph.mutedTrackIds.add(track.id);
        }
        if (track.isSoloed) {
          graph.soloedTrackIds.add(track.id);
        }

        const entries = await this.createScheduledRegionEntries({
          input,
          regions: track.regions.map(region => this.cloneRegionData(region)),
        });
        const trackPlayers = graph.players.get(track.id);
        entries.forEach(entry => trackPlayers?.set(entry.regionData.id, entry));
      }

      this.applyGraphAudibility(graph);
      return graph;
    } catch (error) {
      this.disposeGraph(graph, '실패한 프로젝트 그래프 준비 자원 정리에 실패했습니다.');
      if (error instanceof AudioEngineError) {
        throw error;
      }

      throw new AudioEngineError(AudioEngineErrorCode.TRACK_INIT_FAILED, ERROR_MESSAGES.TRACK_INIT_FAILED, {
        cause: this.describeError(error),
      });
    }
  }

  private assertUniquePreparedRegionIds(trackId: string, regions: readonly RegionData[]): void {
    const regionIds = new Set<string>();
    const duplicateRegion = regions.find(region => {
      if (regionIds.has(region.id)) {
        return true;
      }
      regionIds.add(region.id);
      return false;
    });
    if (!duplicateRegion) {
      return;
    }

    throw this.createRegionIdConflictError({ trackId, regionId: duplicateRegion.id });
  }

  private createEmptyGraph(outputGain: number): AudioProjectGraphState {
    return {
      output: this.createGraphOutput(outputGain),
      trackInputs: new Map(),
      channels: new Map(),
      desiredTrackVolumes: new Map(),
      mutedTrackIds: new Set(),
      soloedTrackIds: new Set(),
      players: new Map(),
      pluginRuntimes: new Map(),
      disabledPluginInstanceIds: new Map(),
    };
  }

  private captureActiveGraph(): AudioProjectGraphState {
    return {
      output: this.output,
      trackInputs: this.trackInputs,
      channels: this.channels,
      desiredTrackVolumes: this.desiredTrackVolumes,
      mutedTrackIds: this.mutedTrackIds,
      soloedTrackIds: this.soloedTrackIds,
      players: this.players,
      pluginRuntimes: this.pluginRuntimes,
      disabledPluginInstanceIds: this.disabledPluginInstanceIds,
    };
  }

  private useGraph(graph: AudioProjectGraphState): void {
    this.output = graph.output;
    this.trackInputs = graph.trackInputs;
    this.channels = graph.channels;
    this.desiredTrackVolumes = graph.desiredTrackVolumes;
    this.mutedTrackIds = graph.mutedTrackIds;
    this.soloedTrackIds = graph.soloedTrackIds;
    this.players = graph.players;
    this.pluginRuntimes = graph.pluginRuntimes;
    this.disabledPluginInstanceIds = graph.disabledPluginInstanceIds;
  }

  private createRetiredGraph(graph: AudioProjectGraphState): IRetiredAudioProjectGraph {
    this.pendingGraphCleanup.add(graph);

    return {
      dispose: () => this.disposeGraph(graph, '이전 프로젝트 오디오 그래프 정리에 실패했습니다.'),
    };
  }

  private disposeGraph(graph: AudioProjectGraphState, errorMessage: string): ResourceCleanupResult {
    this.pendingGraphCleanup.add(graph);
    const isOutputDisposed = this.disposeOutput(graph.output, errorMessage);

    graph.players.forEach((trackPlayers, trackId) => {
      trackPlayers.forEach((entry, regionId) => {
        if (this.disposePlayerSafely(entry.player, errorMessage)) {
          trackPlayers.delete(regionId);
        }
      });
      if (trackPlayers.size === 0) {
        graph.players.delete(trackId);
      }
    });

    graph.pluginRuntimes.forEach((runtimes, trackId) => {
      const remainingRuntimes = runtimes.filter(runtime => !this.disposePluginRuntimeSafely(runtime, errorMessage));
      if (remainingRuntimes.length === 0) {
        graph.pluginRuntimes.delete(trackId);
        graph.disabledPluginInstanceIds.delete(trackId);
        return;
      }
      graph.pluginRuntimes.set(trackId, remainingRuntimes);
    });

    graph.trackInputs.forEach((input, trackId) => {
      if (this.disposeTrackInputSafely(input, errorMessage)) {
        graph.trackInputs.delete(trackId);
      }
    });

    graph.channels.forEach((channel, trackId) => {
      if (this.disposeChannelSafely(channel, errorMessage)) {
        graph.channels.delete(trackId);
        graph.desiredTrackVolumes.delete(trackId);
        graph.mutedTrackIds.delete(trackId);
        graph.soloedTrackIds.delete(trackId);
      }
    });

    const failedPlayerCount = [...graph.players.values()].reduce(
      (playerCount, trackPlayers) => playerCount + trackPlayers.size,
      0
    );
    const failedPluginRuntimeCount = [...graph.pluginRuntimes.values()].reduce(
      (runtimeCount, runtimes) => runtimeCount + runtimes.length,
      0
    );
    const failedResourceCount =
      failedPlayerCount +
      failedPluginRuntimeCount +
      graph.trackInputs.size +
      graph.channels.size +
      (isOutputDisposed ? 0 : 1);
    if (failedResourceCount > 0) {
      return { isComplete: false, failedResourceCount };
    }

    this.pendingGraphCleanup.delete(graph);
    return COMPLETE_RESOURCE_CLEANUP;
  }

  private activatePreparedGraph(preparedGraph: AudioProjectGraphState): AudioProjectGraphState {
    const previousGraph = this.captureActiveGraph();
    const transport = Tone.getTransport();
    const transportSnapshot: TransportSnapshot = {
      seconds: transport.seconds,
      state: transport.state,
    };

    try {
      transport.stop();
      transport.seconds = 0;
      this.setOutputMuted(previousGraph.output, true);
      this.setOutputMuted(preparedGraph.output, false);
    } catch (cause) {
      const rollbackResult = this.rollbackGraphActivation({
        preparedGraph,
        previousGraph,
        transportSnapshot,
      });
      throw new AudioEngineError(
        AudioEngineErrorCode.PROJECT_GRAPH_ACTIVATION_FAILED,
        ERROR_MESSAGES.PROJECT_GRAPH_ACTIVATION_FAILED,
        {
          cause: this.describeError(cause),
          compensationFailures: rollbackResult.compensationFailures,
          isRuntimeRecoveryPending: rollbackResult.isRuntimeRecoveryPending,
        }
      );
    }

    this.useGraph(preparedGraph);
    return previousGraph;
  }

  private rollbackGraphActivation({
    preparedGraph,
    previousGraph,
    transportSnapshot,
  }: {
    readonly preparedGraph: AudioProjectGraphState;
    readonly previousGraph: AudioProjectGraphState;
    readonly transportSnapshot: TransportSnapshot;
  }): GraphActivationRollbackResult {
    const compensationFailures: string[] = [];
    this.tryCompensation(
      () => this.setOutputMuted(preparedGraph.output, true, true),
      'PREPARED_OUTPUT_MUTE',
      compensationFailures
    );
    this.tryOutputStateRecovery(previousGraph.output, false, 'PREVIOUS_OUTPUT_UNMUTE', compensationFailures);
    this.tryTransportRecovery(transportSnapshot, compensationFailures);
    compensationFailures.push(...this.retryPendingRuntimeRecovery());
    return {
      compensationFailures,
      isRuntimeRecoveryPending: this.hasPendingRuntimeRecovery(),
    };
  }

  private tryCompensation(operation: () => void, step: string, failures: string[]): void {
    try {
      operation();
    } catch (error) {
      failures.push(`${step}: ${this.describeError(error)}`);
    }
  }

  private restoreTransport(snapshot: TransportSnapshot): void {
    const transport = Tone.getTransport();
    transport.stop();
    transport.seconds = snapshot.seconds;
    if (snapshot.state === 'started') {
      transport.start();
      return;
    }
    if (snapshot.state === 'paused') {
      transport.start();
      transport.pause();
    }
  }

  private createGraphOutput(gain: number): Tone.Gain {
    const output = new Tone.Gain({ gain });
    if (gain === 0) {
      this.mutedOutputs.add(output);
    }

    try {
      output.toDestination();
      return output;
    } catch (cause) {
      this.pendingOutputCleanup.add(output);
      this.disposeOutput(output, '연결에 실패한 프로젝트 출력 정리에 실패했습니다.');
      throw new AudioEngineError(AudioEngineErrorCode.TRACK_INIT_FAILED, ERROR_MESSAGES.TRACK_INIT_FAILED, {
        cause: this.describeError(cause),
      });
    }
  }

  private setOutputMuted(output: Tone.Gain, muted: boolean, force = false): void {
    if (!force && muted === this.mutedOutputs.has(output)) {
      return;
    }

    output.gain.value = muted ? 0 : 1;
    if (muted) {
      this.mutedOutputs.add(output);
    } else {
      this.mutedOutputs.delete(output);
    }
    if (this.pendingOutputStateRecovery.get(output) === muted) {
      this.pendingOutputStateRecovery.delete(output);
    }
  }

  private disposeOutput(output: Tone.Gain, errorMessage: string): boolean {
    this.pendingOutputCleanup.add(output);
    this.tryCleanupStep(() => this.setOutputMuted(output, true), errorMessage);

    if (!this.disconnectedOutputs.has(output)) {
      const isDisconnected = this.tryCleanupStep(() => output.disconnect(), errorMessage);
      if (isDisconnected) {
        this.disconnectedOutputs.add(output);
      }
    }

    if (!this.disposedOutputs.has(output)) {
      const isDisposed = this.tryCleanupStep(() => output.dispose(), errorMessage);
      if (isDisposed) {
        this.disposedOutputs.add(output);
      }
    }

    const isComplete = this.disposedOutputs.has(output);
    if (isComplete) {
      this.pendingOutputCleanup.delete(output);
      this.pendingOutputStateRecovery.delete(output);
    }
    return isComplete;
  }

  private disposeChannelSafely(channel: Tone.Channel, errorMessage: string): boolean {
    this.pendingChannelCleanup.add(channel);
    if (!this.disconnectedChannels.has(channel)) {
      const isDisconnected = this.tryCleanupStep(() => channel.disconnect(), errorMessage);
      if (isDisconnected) {
        this.disconnectedChannels.add(channel);
      }
    }

    if (!this.disposedChannels.has(channel)) {
      const isDisposed = this.tryCleanupStep(() => channel.dispose(), errorMessage);
      if (isDisposed) {
        this.disposedChannels.add(channel);
      }
    }

    const isComplete = this.disposedChannels.has(channel);
    if (isComplete) {
      this.pendingChannelCleanup.delete(channel);
    }
    return isComplete;
  }

  private disposeChannel(channel: Tone.Channel): void {
    channel.disconnect();
    channel.dispose();
  }

  private disposeTrackInputSafely(input: Tone.Gain, errorMessage: string): boolean {
    this.pendingTrackInputCleanup.add(input);
    if (!this.disconnectedTrackInputs.has(input)) {
      const isDisconnected = this.tryCleanupStep(() => input.disconnect(), errorMessage);
      if (isDisconnected) {
        this.disconnectedTrackInputs.add(input);
      }
    }

    if (!this.disposedTrackInputs.has(input)) {
      const isDisposed = this.tryCleanupStep(() => input.dispose(), errorMessage);
      if (isDisposed) {
        this.disposedTrackInputs.add(input);
      }
    }

    const isComplete = this.disposedTrackInputs.has(input);
    if (isComplete) {
      this.pendingTrackInputCleanup.delete(input);
    }
    return isComplete;
  }

  private disposeTrackInput(input: Tone.Gain): void {
    input.disconnect();
    input.dispose();
  }

  private disposePluginRuntimeSafely(runtime: IAudioPluginRuntime, errorMessage: string): boolean {
    this.pendingPluginRuntimeCleanup.add(runtime);
    if (!this.disconnectedPluginRuntimes.has(runtime)) {
      const isDisconnected = this.tryCleanupStep(() => runtime.disconnect(), errorMessage);
      if (isDisconnected) {
        this.disconnectedPluginRuntimes.add(runtime);
      }
    }

    if (!this.disposedPluginRuntimes.has(runtime)) {
      const isDisposed = this.tryCleanupStep(() => runtime.dispose(), errorMessage);
      if (isDisposed) {
        this.disposedPluginRuntimes.add(runtime);
      }
    }

    const isComplete = this.disposedPluginRuntimes.has(runtime);
    if (isComplete) {
      this.pendingPluginRuntimeCleanup.delete(runtime);
    }
    return isComplete;
  }

  private applyGraphAudibility(graph: AudioProjectGraphState): void {
    graph.channels.forEach((channel, trackId) => {
      const shouldMute = this.isTrackMutedInGraph(graph, trackId);
      channel.mute = shouldMute;
      if (!shouldMute) {
        const desiredVolume = graph.desiredTrackVolumes.get(trackId) ?? 1;
        channel.volume.value = Tone.gainToDb(desiredVolume);
      }
    });
  }

  private isTrackMutedInGraph(graph: AudioProjectGraphState, trackId: string): boolean {
    if (graph.mutedTrackIds.has(trackId)) {
      return true;
    }

    return graph.soloedTrackIds.size > 0 && !graph.soloedTrackIds.has(trackId);
  }

  private retryPendingCleanup(): void {
    [...this.pendingOutputCleanup].forEach(output =>
      this.disposeOutput(output, '대기 중인 프로젝트 출력 정리에 실패했습니다.')
    );
    [...this.pendingChannelCleanup].forEach(channel =>
      this.disposeChannelSafely(channel, '대기 중인 Channel 정리에 실패했습니다.')
    );
    [...this.pendingTrackInputCleanup].forEach(input =>
      this.disposeTrackInputSafely(input, '대기 중인 Track input 정리에 실패했습니다.')
    );
    [...this.pendingPlayerCleanup].forEach(player =>
      this.disposePlayerSafely(player, '대기 중인 Region Player 정리에 실패했습니다.')
    );
    [...this.pendingPluginRuntimeCleanup].forEach(runtime =>
      this.disposePluginRuntimeSafely(runtime, '대기 중인 Plugin runtime 정리에 실패했습니다.')
    );
    [...this.pendingGraphCleanup].forEach(graph =>
      this.disposeGraph(graph, '대기 중인 프로젝트 그래프 정리에 실패했습니다.')
    );
  }

  private ensureRuntimeReady(): void {
    if (!this.hasPendingRuntimeRecovery()) {
      return;
    }

    const recoveryFailures = this.retryPendingRuntimeRecovery();
    if (!this.hasPendingRuntimeRecovery()) {
      return;
    }

    throw new AudioEngineError(
      AudioEngineErrorCode.PROJECT_RUNTIME_RECOVERY_PENDING,
      ERROR_MESSAGES.PROJECT_RUNTIME_RECOVERY_PENDING,
      { recoveryFailures }
    );
  }

  private ensureRuntimeReadyOrCleanupEntries(entries: RegionPlayerEntry[]): void {
    try {
      this.ensureRuntimeReady();
    } catch (error) {
      this.cleanupRegionEntries(entries);
      throw error;
    }
  }

  private hasPendingRuntimeRecovery(): boolean {
    return (
      this.pendingOutputStateRecovery.size > 0 ||
      this.pendingPluginChainRecovery.size > 0 ||
      this.pendingTransportRecovery !== null
    );
  }

  private retryPendingRuntimeRecovery(): string[] {
    const failures: string[] = [];
    [...this.pendingOutputStateRecovery].forEach(([output, muted]) => {
      this.tryOutputStateRecovery(output, muted, 'OUTPUT_STATE_RETRY', failures);
    });
    [...this.pendingPluginChainRecovery.values()].forEach(recoveryState => {
      const failure = this.tryPluginChainRecovery(recoveryState);
      if (failure) {
        failures.push(`PLUGIN_CHAIN_RESTORE: ${failure}`);
      }
    });
    if (this.pendingTransportRecovery) {
      this.tryTransportRecovery(this.pendingTransportRecovery, failures);
    }
    return failures;
  }

  private tryOutputStateRecovery(output: Tone.Gain, muted: boolean, step: string, failures: string[]): void {
    try {
      this.setOutputMuted(output, muted, true);
    } catch (error) {
      this.pendingOutputStateRecovery.set(output, muted);
      failures.push(`${step}: ${this.describeError(error)}`);
    }
  }

  private tryTransportRecovery(snapshot: TransportSnapshot, failures: string[]): void {
    try {
      this.restoreTransport(snapshot);
      this.pendingTransportRecovery = null;
    } catch (error) {
      this.pendingTransportRecovery = snapshot;
      failures.push(`TRANSPORT_RESTORE: ${this.describeError(error)}`);
    }
  }

  private tryCleanupStep(operation: () => unknown, errorMessage: string): boolean {
    try {
      operation();
      return true;
    } catch (error) {
      console.error(`[AudioEngine] ${errorMessage}`, error);
      return false;
    }
  }

  private getExistingChannel(trackId: string): Tone.Channel {
    const channel = this.channels.get(trackId);
    if (!channel) {
      throw new AudioEngineError(AudioEngineErrorCode.TRACK_NOT_FOUND, ERROR_MESSAGES.TRACK_NOT_FOUND, { trackId });
    }
    return channel;
  }

  private getExistingInput(trackId: string): Tone.Gain {
    const input = this.trackInputs.get(trackId);
    if (!input) {
      throw new AudioEngineError(AudioEngineErrorCode.TRACK_NOT_FOUND, ERROR_MESSAGES.TRACK_NOT_FOUND, { trackId });
    }
    return input;
  }

  private getTrackPluginRuntimes(trackId: string): IAudioPluginRuntime[] {
    const runtimes = this.pluginRuntimes.get(trackId);
    if (!runtimes) {
      throw new AudioEngineError(AudioEngineErrorCode.TRACK_NOT_FOUND, ERROR_MESSAGES.TRACK_NOT_FOUND, { trackId });
    }
    return runtimes;
  }

  private getTrackDisabledPluginInstanceIds(trackId: string): Set<string> {
    const instanceIds = this.disabledPluginInstanceIds.get(trackId);
    if (!instanceIds) {
      throw new AudioEngineError(AudioEngineErrorCode.TRACK_NOT_FOUND, ERROR_MESSAGES.TRACK_NOT_FOUND, { trackId });
    }
    return instanceIds;
  }

  private getRegionEntry(request: RescheduleRegionRequest): RegionPlayerEntry {
    const entry = this.players.get(request.trackId)?.get(request.regionId);
    if (!entry) {
      throw this.createRegionNotFoundError(request);
    }
    return entry;
  }

  private async createScheduledRegionEntries(request: CreateRegionEntriesRequest): Promise<RegionPlayerEntry[]> {
    const entries: RegionPlayerEntry[] = [];

    try {
      request.regions.forEach(regionData => {
        const entry = {
          player: new Tone.Player({ loop: false }),
          regionData: this.cloneRegionData(regionData),
          revision: 0,
        };
        entries.push(entry);
        entry.player.connect(request.input);
      });
    } catch (cause) {
      this.cleanupRegionEntries(entries);
      throw new AudioEngineError(AudioEngineErrorCode.TRACK_INIT_FAILED, ERROR_MESSAGES.TRACK_INIT_FAILED, {
        cause: this.describeError(cause),
      });
    }

    const loadResults = await Promise.allSettled(entries.map(entry => entry.player.load(entry.regionData.url)));
    const loadFailure = loadResults.find(result => result.status === 'rejected');
    if (loadFailure?.status === 'rejected') {
      this.cleanupRegionEntries(entries);
      throw new AudioEngineError(AudioEngineErrorCode.REGION_LOAD_FAILED, ERROR_MESSAGES.REGION_LOAD_FAILED, {
        cause: this.describeError(loadFailure.reason),
      });
    }

    try {
      entries.forEach(entry => this.schedulePlayer(entry.player, entry.regionData));
    } catch (error) {
      this.cleanupRegionEntries(entries);
      throw new AudioEngineError(AudioEngineErrorCode.REGION_SCHEDULE_FAILED, ERROR_MESSAGES.REGION_SCHEDULE_FAILED, {
        cause: this.describeError(error),
      });
    }

    return entries;
  }

  private schedulePlayer(player: Tone.Player, regionData: RegionData): void {
    startPlayer({
      player,
      syncMode: true,
      startTime: regionData.startTime,
      startOffset: regionData.sourceStartTime,
      duration: regionData.duration,
    });
  }

  private validateReplacementIds(trackPlayers: Map<string, RegionPlayerEntry>, request: ReplaceRegionRequest): void {
    const replacementIds = new Set<string>();
    const hasConflict = request.replacements.some(replacement => {
      if (replacementIds.has(replacement.id)) {
        return true;
      }
      replacementIds.add(replacement.id);
      return replacement.id !== request.regionId && trackPlayers.has(replacement.id);
    });

    if (hasConflict) {
      throw this.createRegionIdConflictError(request);
    }
  }

  private createRegionIdConflictError(request: { trackId: string; regionId: string }): AudioEngineError {
    return new AudioEngineError(AudioEngineErrorCode.REGION_ID_CONFLICT, ERROR_MESSAGES.REGION_ID_CONFLICT, {
      trackId: request.trackId,
      regionId: request.regionId,
    });
  }

  private createRegionStateChangedError(request: { trackId: string; regionId: string }): AudioEngineError {
    return new AudioEngineError(AudioEngineErrorCode.REGION_STATE_CHANGED, ERROR_MESSAGES.REGION_STATE_CHANGED, {
      trackId: request.trackId,
      regionId: request.regionId,
    });
  }

  private createRegionNotFoundError(request: { trackId: string; regionId: string }): AudioEngineError {
    return new AudioEngineError(AudioEngineErrorCode.REGION_NOT_FOUND, ERROR_MESSAGES.REGION_NOT_FOUND, {
      trackId: request.trackId,
      regionId: request.regionId,
    });
  }

  private cloneRegionData(regionData: RegionData): RegionData {
    return { ...regionData };
  }

  private cleanupRegionEntries(entries: RegionPlayerEntry[]): void {
    entries.forEach(entry => {
      this.disposePlayerSafely(entry.player, 'Region Player 정리에 실패했습니다.');
    });
  }

  private disposePlayer(player: Tone.Player): void {
    player.unsync();
    player.stop();
    player.disconnect();
    player.dispose();
  }

  private disposePlayerSafely(player: Tone.Player, errorMessage: string): boolean {
    this.pendingPlayerCleanup.add(player);
    if (!this.unsyncedPlayers.has(player)) {
      const isUnsynced = this.tryCleanupStep(() => player.unsync(), errorMessage);
      if (isUnsynced) {
        this.unsyncedPlayers.add(player);
      }
    }
    if (!this.stoppedPlayers.has(player)) {
      const isStopped = this.tryCleanupStep(() => player.stop(), errorMessage);
      if (isStopped) {
        this.stoppedPlayers.add(player);
      }
    }
    if (!this.disconnectedPlayers.has(player)) {
      const isDisconnected = this.tryCleanupStep(() => player.disconnect(), errorMessage);
      if (isDisconnected) {
        this.disconnectedPlayers.add(player);
      }
    }
    if (!this.disposedPlayers.has(player)) {
      const isDisposed = this.tryCleanupStep(() => player.dispose(), errorMessage);
      if (isDisposed) {
        this.disposedPlayers.add(player);
      }
    }

    const isComplete = this.disposedPlayers.has(player);
    if (isComplete) {
      this.pendingPlayerCleanup.delete(player);
    }
    return isComplete;
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private validatePluginTargetIndex({
    trackId,
    instanceId,
    targetIndex,
    maximumIndex,
  }: ValidatePluginTargetIndexRequest): void {
    if (Number.isInteger(targetIndex) && targetIndex >= 0 && targetIndex <= maximumIndex) {
      return;
    }
    throw new AudioEngineError(
      AudioEngineErrorCode.PLUGIN_TARGET_INDEX_OUT_OF_RANGE,
      ERROR_MESSAGES.PLUGIN_TARGET_INDEX_OUT_OF_RANGE,
      { instanceId, maximumIndex, targetIndex, trackId }
    );
  }

  private async scheduleExport(request: ExportRequest): Promise<void> {
    const scheduledPlayers: Array<{ player: Tone.Player; params: RegionRenderParams }> = [];

    for (const track of this.getAudibleTracks(request.tracks)) {
      const channel = new Tone.Channel({
        volume: Tone.gainToDb(track.volume * request.masterVolume),
        pan: track.pan,
      }).toDestination();
      const input = new Tone.Gain({ gain: 1 });
      const pluginRuntimes = this.createPreparedPluginRuntimes({
        trackId: track.id,
        pluginInstances: track.pluginInstances,
      });
      const disabledPluginInstanceIds = new Set(
        track.pluginInstances.filter(instance => !instance.isEnabled).map(instance => instance.instanceId)
      );
      this.connectPreparedPluginChain({
        input,
        channel,
        runtimes: getEnabledPluginRuntimes(pluginRuntimes, disabledPluginInstanceIds),
        trackId: track.id,
      });

      for (const region of track.regions) {
        const params = RegionRenderer.adjustForExportRange(RegionRenderer.calculateRenderParams(region), request.range);
        if (params.duration <= 0) {
          continue;
        }

        scheduledPlayers.push({ player: new Tone.Player({ loop: false }).connect(input), params });
      }
    }

    await Promise.all(scheduledPlayers.map(({ player, params }) => player.load(params.url)));
    scheduledPlayers.forEach(({ player, params }) => {
      startPlayer({ player, syncMode: false, ...params });
    });
  }

  private getAudibleTracks(tracks: ExportTrack[]): ExportTrack[] {
    const hasSoloTrack = tracks.some(track => track.isSoloed);
    return tracks.filter(track => !track.isMuted && (!hasSoloTrack || track.isSoloed));
  }
}

function createPluginRuntimeFactoryMap(
  factories: readonly IAudioPluginRuntimeFactory[]
): ReadonlyMap<string, IAudioPluginRuntimeFactory> {
  const factoryMap = new Map<string, IAudioPluginRuntimeFactory>();
  factories.forEach(factory => {
    if (factoryMap.has(factory.manifestId)) {
      throw new AudioEngineError(
        AudioEngineErrorCode.PLUGIN_FACTORY_ID_CONFLICT,
        ERROR_MESSAGES.PLUGIN_FACTORY_ID_CONFLICT,
        { manifestId: factory.manifestId }
      );
    }
    factoryMap.set(factory.manifestId, factory);
  });
  return factoryMap;
}

function getUniquePluginRuntimes(runtimes: readonly IAudioPluginRuntime[]): IAudioPluginRuntime[] {
  return [...new Set(runtimes)];
}

function getEnabledPluginRuntimes(
  runtimes: readonly IAudioPluginRuntime[],
  disabledInstanceIds: ReadonlySet<string>
): IAudioPluginRuntime[] {
  return runtimes.filter(runtime => !disabledInstanceIds.has(runtime.instanceId));
}
