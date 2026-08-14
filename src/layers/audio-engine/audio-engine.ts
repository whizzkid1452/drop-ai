import * as Tone from 'tone';
import { insertArrayEntry, moveArrayEntry } from '../shared/array-order';
import { COMPLETE_RESOURCE_CLEANUP, type ResourceCleanupResult } from '../shared/types/resource-cleanup';
import {
  AUDIO_MONITOR_DIM_GAIN,
  cloneAudioMonitorState,
  DEFAULT_AUDIO_MONITOR_STATE,
  type AudioMonitorState,
  type AudioMonitorStateListener,
} from '../shared/types/audio-monitor-state';
import type { TimelineRange } from '../shared/types/project-document.schema';
import {
  createDefaultRoutingGraphSnapshot,
  removeTrackFromRoutingGraph,
  type RoutingGraphSnapshot,
} from '../shared/types/routing-state';
import {
  cloneAutomationLaneState,
  type AutomationLaneState,
  type AutomationTarget,
} from '../shared/types/automation-state';
import {
  AudioRuntimeFeature,
  CURRENT_AUDIO_RUNTIME_FEATURE_SUPPORT,
  type AudioRuntimeFeatureSupport,
} from '../shared/utils/audio-runtime-capabilities';
import { startPlayer } from './config/player-config';
import { encodeAudioBufferToWav } from './encoders/wav-encoder';
import { analyzeRenderedPcm, calculateNormalizationGainDb } from './analysis/render-analysis';
import { AudioEngineError, AudioEngineErrorCode, ERROR_MESSAGES, UnsupportedAudioFeatureError } from './errors';
import type {
  AudioProjectGraphPluginInstance,
  AuditionAudioSourceRequest,
  ArmLoopRequest,
  ConfigureLoopRequest,
  ExportRequest,
  ExportTrack,
  IAudioEngine,
  InstallAudioPluginRequest,
  LoadLoopRequest,
  LiveAudioInputDevice,
  LiveInputRuntimeListener,
  LiveInputRuntimeState,
  LoopRuntimeListener,
  LoopSlotAddress,
  MeterFrame,
  MeterTarget,
  MultiTrackRecordingResult,
  RecordingRuntimeListener,
  RecordingRuntimeState,
  MoveAudioPluginRequest,
  IPreparedAudioProjectGraph,
  IRetiredAudioProjectGraph,
  PrepareAudioProjectGraphRequest,
  RegionData,
  AnalyzeAudioRegionPeakRequest,
  RenderDerivedAudioRegionRequest,
  RenderedDerivedAudioRegion,
  ReplaceRegionRequest,
  RescheduleRegionRequest,
  SetAudioTempoMapRequest,
  SetAudioPluginEnabledRequest,
  SetAudioPluginParameterRequest,
  SetAudioPluginSidechainRequest,
  SetAutomationLanesRequest,
  SetMidiTrackStateRequest,
  SendMidiInputEventRequest,
  SetLiveInputMonitoringRequest,
  SetTrackRecordArmRequest,
  SetTrackRecordingInputRequest,
  StartLinearRecordingRequest,
  StartRenderJobRequest,
  StopAllLoopsRequest,
  TriggerLoopRequest,
} from './i-audio-engine';
import type {
  ILoopAudioRuntime,
  IPreparedLoopRuntimeReplacement,
  IRetiredLoopRuntime,
  LoadLoopRuntimeRequest,
} from './loop-runtime/loop-runtime-contract';
import { UnavailableLoopAudioRuntime } from './loop-runtime/unavailable-loop-audio-runtime';
import type { IAudioMeterRuntime } from './metering/audio-meter-runtime';
import { ToneMeterRuntimeFactory, type IAudioMeterRuntimeFactory } from './metering/tone-meter-runtime-factory';
import type { IAudioPluginRuntime, IAudioPluginRuntimeFactory } from './plugins/audio-plugin-runtime';
import { AudioPluginRuntimeError } from './plugins/errors';
import type { ILinearRecordingAudioRuntime } from './recording-runtime/linear-recording-runtime';
import { RegionRenderer, type RegionRenderParams } from './renderers/region-renderer';
import { createAudibleRegionSegments } from './region-playback-segments';
import {
  analyzePcmPeak,
  detectTransientPositionsSeconds,
  pitchShiftPcmChannels,
  reversePcmChannels,
  stripSilenceFromPcmChannels,
  timeStretchPcmChannels,
} from './region-audio-processing';
import { ToneTransportRuntime } from './transport-runtime/tone-transport-runtime';
import { AudioRoutingRuntime, type AudioRoutingTrackNodes } from './routing/audio-routing-runtime';
import { scheduleAutomationLane, type IAutomationAudioTarget } from './automation/automation-param-scheduler';
import { ToneAutomationRuntime } from './automation/tone-automation-runtime';
import { createMappedAutomationTarget } from './automation/tone-automation-target';
import { ToneMidiRuntime } from './midi/tone-midi-runtime';
import { BUILTIN_MIDI_INSTRUMENT_ID } from '../shared/types/midi-state';
import type { PluginRuntimeState } from '../shared/types/plugin-state';
import { createDefaultExportPreset, type ExportPresetState, type ExportRangeState } from '../shared/types/export-state';
import {
  createIdleRenderJobState,
  type RenderJobFile,
  type RenderJobResult,
  type RenderJobState,
  type RenderJobStateListener,
} from '../shared/types/render-job';
import type { AudioEngineRuntimeHealth, RuntimeAudioContextState } from '../shared/types/runtime-diagnostics';

function normalizeAudioContextState(state: string): RuntimeAudioContextState {
  if (state === 'closed' || state === 'interrupted' || state === 'running' || state === 'suspended') {
    return state;
  }
  return 'unavailable';
}

interface RegionPlayerEntry {
  players: Tone.Player[];
  playbackSegments: RegionData[];
  regionData: RegionData;
  revision: number;
}

interface CreateRegionEntriesRequest {
  input: Tone.Gain;
  regions: RegionData[];
  schedulingRegions?: readonly RegionData[];
}

interface AudioProjectGraphState {
  readonly output: Tone.Gain;
  readonly monitorMono: Tone.Mono;
  readonly masterMeterRuntime: IAudioMeterRuntime;
  readonly trackInputs: Map<string, Tone.Gain>;
  readonly preFaderOutputs: Map<string, Tone.Gain>;
  readonly postFaderOutputs: Map<string, Tone.Gain>;
  readonly trackMeterRuntimes: Map<string, IAudioMeterRuntime>;
  readonly channels: Map<string, Tone.Channel>;
  readonly desiredTrackVolumes: Map<string, number>;
  readonly desiredTrackPans: Map<string, number>;
  readonly automationLanes: Map<string, AutomationLaneState[]>;
  readonly mutedTrackIds: Set<string>;
  readonly soloedTrackIds: Set<string>;
  readonly players: Map<string, Map<string, RegionPlayerEntry>>;
  readonly pluginRuntimes: Map<string, IAudioPluginRuntime[]>;
  readonly disabledPluginInstanceIds: Map<string, Set<string>>;
  readonly pluginRuntimeStates: Map<string, PluginRuntimeState[]>;
  readonly pluginSidechainSourceTrackIds: Map<string, Map<string, string>>;
  readonly routingRuntime: AudioRoutingRuntime;
  readonly midiRuntime: ToneMidiRuntime;
}

interface AudioEngineOptions {
  readonly loopRuntime?: ILoopAudioRuntime;
  readonly meterRuntimeFactory?: IAudioMeterRuntimeFactory;
  readonly pluginRuntimeFactories?: readonly IAudioPluginRuntimeFactory[];
  readonly recordingRuntime?: ILinearRecordingAudioRuntime;
}

interface CreateGraphOutputRequest {
  readonly initialGain: number;
  readonly monitorState?: AudioMonitorState;
  readonly unmutedGain: number;
}

interface CreatePreparedPluginRuntimesRequest {
  readonly trackId: string;
  readonly pluginInstances: readonly AudioProjectGraphPluginInstance[];
}

interface PreparedPluginRuntimeResult {
  readonly runtimes: IAudioPluginRuntime[];
  readonly states: PluginRuntimeState[];
}

interface OfflineExportTrackRuntime {
  readonly channel: Tone.Channel;
  readonly input: Tone.Gain;
  readonly pluginRuntimes: readonly IAudioPluginRuntime[];
  readonly postFaderOutput: Tone.Gain;
  readonly preFaderOutput: Tone.Gain;
  readonly track: ExportTrack;
}

interface ValidatePluginTargetIndexRequest extends MoveAudioPluginRequest {
  readonly maximumIndex: number;
}

interface ConnectPreparedPluginChainRequest {
  readonly input: Tone.Gain;
  readonly destination: Tone.ToneAudioNode;
  readonly runtimes: readonly IAudioPluginRuntime[];
  readonly trackId: string;
}

interface RenderJobOutput {
  readonly fileName: string;
  readonly range: ExportRangeState;
  readonly request: ExportRequest;
  readonly trackId: string | null;
}

interface ReplacePluginChainConnectionsRequest {
  readonly trackId: string;
  readonly input: Tone.Gain;
  readonly destination: Tone.ToneAudioNode;
  readonly previousRuntimes: readonly IAudioPluginRuntime[];
  readonly nextRuntimes: readonly IAudioPluginRuntime[];
  readonly runtimesToDisposeOnRollback: readonly IAudioPluginRuntime[];
}

interface PluginChainRecoveryState {
  readonly trackId: string;
  readonly input: Tone.Gain;
  readonly destination: Tone.ToneAudioNode;
  readonly targetRuntimes: readonly IAudioPluginRuntime[];
  readonly involvedRuntimes: readonly IAudioPluginRuntime[];
  readonly runtimesToDispose: readonly IAudioPluginRuntime[];
}

interface RebuildPluginChainConnectionsRequest {
  readonly input: Tone.Gain;
  readonly destination: Tone.ToneAudioNode;
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
  private monitorMono: Tone.Mono;
  private masterMeterRuntime: IAudioMeterRuntime;
  private trackInputs: Map<string, Tone.Gain> = new Map();
  private preFaderOutputs: Map<string, Tone.Gain> = new Map();
  private postFaderOutputs: Map<string, Tone.Gain> = new Map();
  private trackMeterRuntimes: Map<string, IAudioMeterRuntime> = new Map();
  private channels: Map<string, Tone.Channel> = new Map();
  private desiredTrackVolumes: Map<string, number> = new Map();
  private desiredTrackPans: Map<string, number> = new Map();
  private automationLanes: Map<string, AutomationLaneState[]> = new Map();
  private mutedTrackIds: Set<string> = new Set();
  private soloedTrackIds: Set<string> = new Set();
  private players: Map<string, Map<string, RegionPlayerEntry>> = new Map();
  private sourceAuditionPlayer: Tone.Player | null = null;
  private sourceAuditionRevision = 0;
  private pluginRuntimes: Map<string, IAudioPluginRuntime[]> = new Map();
  private disabledPluginInstanceIds: Map<string, Set<string>> = new Map();
  private pluginRuntimeStates: Map<string, PluginRuntimeState[]> = new Map();
  private pluginSidechainSourceTrackIds: Map<string, Map<string, string>> = new Map();
  private routingRuntime = new AudioRoutingRuntime();
  private midiRuntime = new ToneMidiRuntime();
  private readonly pluginRuntimeFactories: ReadonlyMap<string, IAudioPluginRuntimeFactory>;
  private readonly loopRuntime: ILoopAudioRuntime;
  private readonly recordingRuntime: ILinearRecordingAudioRuntime | null;
  private readonly meterRuntimeFactory: IAudioMeterRuntimeFactory;
  private readonly featureSupport: AudioRuntimeFeatureSupport;
  private readonly transportRuntime = new ToneTransportRuntime();
  private readonly automationRuntime: ToneAutomationRuntime;
  private graphRevision = 0;
  private readonly mutedOutputs = new WeakSet<Tone.Gain>();
  private readonly disconnectedOutputs = new WeakSet<Tone.Gain>();
  private readonly disposedOutputs = new WeakSet<Tone.Gain>();
  private readonly disposedMonitorMonoNodes = new WeakSet<Tone.Mono>();
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
  private readonly disposedMeterRuntimes = new WeakSet<IAudioMeterRuntime>();
  private readonly pendingGraphCleanup = new Set<AudioProjectGraphState>();
  private readonly pendingChannelCleanup = new Set<Tone.Channel>();
  private readonly pendingOutputCleanup = new Set<Tone.Gain>();
  private readonly pendingTrackInputCleanup = new Set<Tone.Gain>();
  private readonly pendingPlayerCleanup = new Set<Tone.Player>();
  private readonly pendingPluginRuntimeCleanup = new Set<IAudioPluginRuntime>();
  private readonly pendingMeterRuntimeCleanup = new Set<IAudioMeterRuntime>();
  private readonly pendingOutputStateRecovery = new Map<Tone.Gain, boolean>();
  private readonly unmutedOutputGains = new WeakMap<Tone.Gain, number>();
  private readonly monitorStates = new WeakMap<Tone.Gain, AudioMonitorState>();
  private readonly pendingPluginChainRecovery = new Map<string, PluginChainRecoveryState>();
  private pendingTransportRecovery: TransportSnapshot | null = null;
  private liveInputDeviceId: string | null = null;
  private monitoringTrackId: string | null = null;
  private readonly liveInputStateListeners = new Set<LiveInputRuntimeListener>();
  private readonly recordingStateListeners = new Set<RecordingRuntimeListener>();
  private readonly monitorStateListeners = new Set<AudioMonitorStateListener>();
  private recordingState: RecordingRuntimeState = {
    armedTrackIds: [],
    inputRoutes: [],
    phase: 'idle',
    recordStartTimeSeconds: null,
  };
  private activeRecordingRequest: StartLinearRecordingRequest | null = null;
  private renderJobState: RenderJobState = createIdleRenderJobState();
  private readonly renderJobStateListeners = new Set<RenderJobStateListener>();
  private cancelledRenderJobId: string | null = null;
  private activeRenderJobId: string | null = null;

  listAvailablePluginManifestIds(): readonly string[] {
    return [...this.pluginRuntimeFactories.keys()];
  }

  readPluginRuntimeStates(trackId: string) {
    return (this.pluginRuntimeStates.get(trackId) ?? []).map(state => ({ ...state }));
  }

  constructor(options: AudioEngineOptions = {}) {
    const {
      loopRuntime,
      meterRuntimeFactory = new ToneMeterRuntimeFactory(),
      pluginRuntimeFactories = [],
      recordingRuntime,
    } = options;
    this.loopRuntime = loopRuntime ?? new UnavailableLoopAudioRuntime();
    this.recordingRuntime = recordingRuntime ?? null;
    this.meterRuntimeFactory = meterRuntimeFactory;
    this.featureSupport = {
      ...CURRENT_AUDIO_RUNTIME_FEATURE_SUPPORT,
      [AudioRuntimeFeature.LIVE_INPUT]: loopRuntime !== undefined,
      [AudioRuntimeFeature.LIVE_LOOP]: loopRuntime !== undefined,
      [AudioRuntimeFeature.METERING]: true,
      [AudioRuntimeFeature.MIDI]: true,
      [AudioRuntimeFeature.LINEAR_RECORDING]: recordingRuntime !== undefined,
      [AudioRuntimeFeature.TEMPO_LOOP_METRONOME]: true,
    };
    this.pluginRuntimeFactories = createPluginRuntimeFactoryMap(pluginRuntimeFactories);
    const outputNodes = this.createGraphOutputNodes({ initialGain: 1, unmutedGain: 1 });
    this.output = outputNodes.output;
    this.monitorMono = outputNodes.monitorMono;
    this.masterMeterRuntime = outputNodes.meterRuntime;
    this.automationRuntime = new ToneAutomationRuntime({
      listTrackLanes: () =>
        [...this.automationLanes].map(([trackId, automationLanes]) => ({ automationLanes, trackId })),
      resolveTarget: request => this.resolveAutomationTarget(this.captureActiveGraph(), request),
    });
  }

  getFeatureSupport(): AudioRuntimeFeatureSupport {
    return this.featureSupport;
  }

  getRuntimeHealth(): AudioEngineRuntimeHealth {
    return {
      audioContextState: normalizeAudioContextState(Tone.getContext().state),
      pendingCleanupResourceCount:
        this.pendingGraphCleanup.size +
        this.pendingChannelCleanup.size +
        this.pendingOutputCleanup.size +
        this.pendingTrackInputCleanup.size +
        this.pendingPlayerCleanup.size +
        this.pendingPluginRuntimeCleanup.size +
        this.pendingMeterRuntimeCleanup.size,
    };
  }

  async resumeRuntime(): Promise<AudioEngineRuntimeHealth> {
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }
    this.retryPendingCleanup();
    return this.getRuntimeHealth();
  }

  async play(): Promise<void> {
    this.ensureRuntimeReady();
    this.retryPendingCleanup();
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }
    this.automationRuntime.refresh();
    await Tone.getTransport().start();
  }

  pause(): void {
    this.ensureRuntimeReady();
    Tone.getTransport().pause();
    this.midiRuntime.panic();
    this.automationRuntime.holdAtCurrentPosition();
  }

  stop(): void {
    this.ensureRuntimeReady();
    Tone.getTransport().stop();
    this.midiRuntime.panic();
    this.automationRuntime.holdAtCurrentPosition();
  }

  setTime(time: number): void {
    this.ensureRuntimeReady();
    this.midiRuntime.panic();
    Tone.getTransport().seconds = time;
    this.automationRuntime.refresh();
  }

  getCurrentTime(): number {
    this.ensureRuntimeReady();
    return Tone.getTransport().seconds;
  }

  setTempoMap(request: SetAudioTempoMapRequest): void {
    this.ensureRuntimeReady();
    this.transportRuntime.setTempoMap(request);
  }

  setLoopRange(range: TimelineRange | null): void {
    this.ensureRuntimeReady();
    this.transportRuntime.setLoopRange(range);
    this.automationRuntime.setLoopRange(range);
  }

  setLoopEnabled(isEnabled: boolean): void {
    this.ensureRuntimeReady();
    this.transportRuntime.setLoopEnabled(isEnabled);
    this.automationRuntime.setLoopEnabled(isEnabled);
  }

  setMetronomeEnabled(isEnabled: boolean): void {
    this.ensureRuntimeReady();
    this.transportRuntime.setMetronomeEnabled(isEnabled);
  }

  setMetronomeVolume(volume: number): void {
    this.ensureRuntimeReady();
    this.transportRuntime.setMetronomeVolume(volume);
  }

  readMeterFrame(target: MeterTarget): MeterFrame {
    this.ensureRuntimeReady();
    if (target.kind === 'input') {
      if (!this.featureSupport.liveInput) {
        throw new UnsupportedAudioFeatureError({ feature: AudioRuntimeFeature.LIVE_INPUT, method: 'readMeterFrame' });
      }
      return this.loopRuntime.readInputMeterFrame();
    }
    if (target.kind === 'master') {
      return this.masterMeterRuntime.read();
    }

    const meterRuntime = this.trackMeterRuntimes.get(target.trackId);
    if (!meterRuntime) {
      throw new AudioEngineError(AudioEngineErrorCode.TRACK_NOT_FOUND, ERROR_MESSAGES.TRACK_NOT_FOUND, {
        trackId: target.trackId,
      });
    }
    return meterRuntime.read();
  }

  getLiveInputState(): LiveInputRuntimeState {
    return { deviceId: this.liveInputDeviceId, monitoringTrackId: this.monitoringTrackId };
  }

  listLiveInputDevices(): Promise<readonly LiveAudioInputDevice[]> {
    return this.loopRuntime.listInputDevices();
  }

  subscribeLiveInputState(listener: LiveInputRuntimeListener): () => void {
    this.liveInputStateListeners.add(listener);
    return () => this.liveInputStateListeners.delete(listener);
  }

  async setLiveInputDevice(deviceId: string | null): Promise<string | null> {
    const resolvedDeviceId = await this.loopRuntime.setInputDevice(deviceId);
    const previousState = this.getLiveInputState();
    this.liveInputDeviceId = resolvedDeviceId;
    this.notifyLiveInputStateChange(previousState);
    return resolvedDeviceId;
  }

  async setLiveInputMonitoring(request: SetLiveInputMonitoringRequest): Promise<void> {
    if (!request.enabled && this.monitoringTrackId !== request.trackId) {
      return;
    }
    const destination = request.enabled ? this.getExistingInput(request.trackId).input : null;
    await this.loopRuntime.setMonitoring({ destination, enabled: request.enabled });
    const previousState = this.getLiveInputState();
    this.monitoringTrackId = request.enabled ? request.trackId : null;
    this.notifyLiveInputStateChange(previousState);
  }

  armLoop(request: ArmLoopRequest): Promise<void> {
    return this.loopRuntime.arm({ ...request, destination: this.getExistingInput(request.trackId).input });
  }

  armLoopOverdub(request: ArmLoopRequest): Promise<void> {
    return this.loopRuntime.overdub({ ...request, destination: this.getExistingInput(request.trackId).input });
  }

  cancelLoop(address: LoopSlotAddress): void {
    this.loopRuntime.cancel(address);
  }

  triggerLoop(request: TriggerLoopRequest): Promise<void> {
    return this.loopRuntime.trigger(request);
  }

  stopLoop(request: TriggerLoopRequest): void {
    this.loopRuntime.stop(request);
  }

  clearLoop(address: LoopSlotAddress): void {
    this.loopRuntime.clear(address);
  }

  configureLoop(request: ConfigureLoopRequest): void {
    this.loopRuntime.configure(request);
  }

  stopAllLoops(request: StopAllLoopsRequest): void {
    this.loopRuntime.stopAll(request);
  }

  loadLoop(request: LoadLoopRequest): Promise<void> {
    return this.loopRuntime.load({ ...request, destination: this.getExistingInput(request.trackId).input });
  }

  subscribeLoopEvents(listener: LoopRuntimeListener): () => void {
    return this.loopRuntime.subscribe(listener);
  }

  getRecordingState(): RecordingRuntimeState {
    return {
      ...this.recordingState,
      armedTrackIds: [...this.recordingState.armedTrackIds],
      inputRoutes: this.recordingState.inputRoutes.map(route => ({ ...route })),
    };
  }

  subscribeRecordingState(listener: RecordingRuntimeListener): () => void {
    this.recordingStateListeners.add(listener);
    return () => this.recordingStateListeners.delete(listener);
  }

  setTrackRecordArm(request: SetTrackRecordArmRequest): void {
    this.getRecordingRuntime('setTrackRecordArm');
    if (this.recordingState.phase !== 'idle') {
      throw new Error('녹음 대기 또는 진행 중에는 Track arm을 변경할 수 없습니다.');
    }
    this.getExistingInput(request.trackId);
    const armedTrackIds = new Set(this.recordingState.armedTrackIds);
    if (!request.armed && !armedTrackIds.has(request.trackId)) {
      return;
    }
    if (request.armed) {
      armedTrackIds.add(request.trackId);
    } else {
      armedTrackIds.delete(request.trackId);
    }
    const hasInputRoute = this.recordingState.inputRoutes.some(route => route.trackId === request.trackId);
    this.updateRecordingState({
      armedTrackIds: [...armedTrackIds],
      inputRoutes:
        request.armed && !hasInputRoute
          ? [
              ...this.recordingState.inputRoutes,
              { channelIndex: 0, deviceId: this.liveInputDeviceId, trackId: request.trackId },
            ]
          : this.recordingState.inputRoutes,
      phase: 'idle',
      recordStartTimeSeconds: null,
    });
  }

  setTrackRecordingInput(request: SetTrackRecordingInputRequest): void {
    this.getRecordingRuntime('setTrackRecordingInput');
    if (this.recordingState.phase !== 'idle') {
      throw new Error('녹음 대기 또는 진행 중에는 Track 입력 Route를 변경할 수 없습니다.');
    }
    this.getExistingInput(request.trackId);
    if (!Number.isInteger(request.channelIndex) || request.channelIndex < 0) {
      throw new RangeError('입력 채널 index는 0 이상의 정수여야 합니다.');
    }
    this.updateRecordingState({
      ...this.recordingState,
      inputRoutes: [
        ...this.recordingState.inputRoutes.filter(route => route.trackId !== request.trackId),
        { ...request },
      ],
    });
  }

  async startRecording(request: StartLinearRecordingRequest): Promise<void> {
    const recordingRuntime = this.getRecordingRuntime('startRecording');
    if (this.recordingState.phase !== 'idle') {
      throw new Error('이미 녹음 대기 또는 녹음이 진행 중입니다.');
    }
    if (this.recordingState.armedTrackIds.length === 0) {
      throw new Error('녹음할 Track이 arm 상태가 아닙니다.');
    }
    if (!Number.isFinite(request.recordStartTimeSeconds) || request.recordStartTimeSeconds < 0) {
      throw new RangeError('녹음 시작 위치는 0 이상의 유한한 값이어야 합니다.');
    }
    if (!Number.isFinite(request.startDelaySeconds) || request.startDelaySeconds < 0) {
      throw new RangeError('녹음 시작 지연은 0 이상의 유한한 값이어야 합니다.');
    }

    this.activeRecordingRequest = { ...request };
    this.updateRecordingState({
      ...this.recordingState,
      phase: 'scheduled',
      recordStartTimeSeconds: request.recordStartTimeSeconds,
    });
    try {
      await recordingRuntime.startRecording({
        assignments: this.recordingState.armedTrackIds.map(trackId => this.getRecordingInputRoute(trackId)),
        startDelaySeconds: request.startDelaySeconds,
        onStarted: () => {
          if (this.activeRecordingRequest !== null && this.recordingState.phase === 'scheduled') {
            this.updateRecordingState({ ...this.recordingState, phase: 'recording' });
          }
        },
      });
    } catch (cause) {
      this.activeRecordingRequest = null;
      this.updateRecordingState({
        ...this.recordingState,
        phase: 'idle',
        recordStartTimeSeconds: null,
      });
      throw cause;
    }
  }

  async stopRecording(): Promise<MultiTrackRecordingResult> {
    const recordingRuntime = this.getRecordingRuntime('stopRecording');
    const activeRequest = this.activeRecordingRequest;
    if (!activeRequest || !['scheduled', 'recording'].includes(this.recordingState.phase)) {
      throw new Error('중지할 녹음이 없습니다.');
    }
    this.updateRecordingState({ ...this.recordingState, phase: 'stopping' });
    try {
      const results = await recordingRuntime.stopRecording();
      return {
        failures: results
          .filter(result => result.status === 'failure')
          .map(result => ({ cause: result.cause, stage: 'capture' as const, trackId: result.trackId })),
        takes: results
          .filter(result => result.status === 'success')
          .map(result => ({
            ...result.capture,
            startedAtSeconds: activeRequest.recordStartTimeSeconds,
            trackId: result.trackId,
          })),
      };
    } finally {
      this.activeRecordingRequest = null;
      this.updateRecordingState({
        ...this.recordingState,
        phase: 'idle',
        recordStartTimeSeconds: null,
      });
    }
  }

  cancelRecording(): void {
    this.getRecordingRuntime('cancelRecording').cancelRecording();
    this.activeRecordingRequest = null;
    this.updateRecordingState({ ...this.recordingState, phase: 'idle', recordStartTimeSeconds: null });
  }

  setMasterVolume(volume: number): void {
    this.ensureRuntimeReady();
    if (!this.mutedOutputs.has(this.output)) {
      this.output.gain.rampTo(this.getMonitorAdjustedGain(this.output, volume), 0.1);
    }
    this.unmutedOutputGains.set(this.output, volume);
    this.graphRevision += 1;
  }

  getMonitorState(): AudioMonitorState {
    return cloneAudioMonitorState(this.monitorStates.get(this.output) ?? DEFAULT_AUDIO_MONITOR_STATE);
  }

  subscribeMonitorState(listener: AudioMonitorStateListener): () => void {
    this.monitorStateListeners.add(listener);
    return () => this.monitorStateListeners.delete(listener);
  }

  setMonitorState(state: AudioMonitorState): void {
    this.ensureRuntimeReady();
    const previousState = this.getMonitorState();
    if (state.isMono !== previousState.isMono) {
      this.replaceMonitorOutputConnection({ nextState: state, previousState });
    }
    this.monitorStates.set(this.output, cloneAudioMonitorState(state));
    if (!this.mutedOutputs.has(this.output)) {
      this.output.gain.rampTo(
        this.getMonitorAdjustedGain(this.output, this.unmutedOutputGains.get(this.output) ?? 1),
        0.05
      );
    }
    this.graphRevision += 1;
    this.monitorStateListeners.forEach(listener => listener(this.getMonitorState()));
  }

  getRoutingGraph(): RoutingGraphSnapshot {
    return this.routingRuntime.getSnapshot();
  }

  setRoutingGraph(graph: RoutingGraphSnapshot): void {
    this.ensureRuntimeReady();
    const activeGraph = this.captureActiveGraph();
    this.assertAutomationRoutingTargetsResolvable(activeGraph, graph);
    const previousRoutingGraph = this.routingRuntime.getSnapshot();
    const trackNodes = this.createRoutingTrackNodes(activeGraph);
    let didApplyRoutingGraph = false;
    try {
      this.routingRuntime.apply(graph, trackNodes, this.output);
      didApplyRoutingGraph = true;
      this.applyGraphAudibility(activeGraph);
      this.automationRuntime.refresh();
    } catch (cause) {
      if (!didApplyRoutingGraph) {
        throw cause;
      }
      try {
        this.routingRuntime.apply(previousRoutingGraph, trackNodes, this.output);
        this.applyGraphAudibility(activeGraph);
        this.automationRuntime.refresh();
      } catch (compensationCause) {
        throw new AudioEngineError(
          AudioEngineErrorCode.AUTOMATION_UPDATE_FAILED,
          ERROR_MESSAGES[AudioEngineErrorCode.AUTOMATION_UPDATE_FAILED],
          {
            cause: this.describeError(cause),
            compensationCause: this.describeError(compensationCause),
          }
        );
      }
      throw cause;
    }
    this.graphRevision += 1;
  }

  async addTrack(trackId: string): Promise<void> {
    this.ensureRuntimeReady();
    console.log(`[AudioEngine] Adding track: ${trackId}`);
    this.getOrInitTrackNodes(trackId);
  }

  async addMidiTrack(trackId: string): Promise<void> {
    await this.addTrack(trackId);
    try {
      this.setMidiTrackState({
        midi: { instrumentId: BUILTIN_MIDI_INSTRUMENT_ID, recordMode: 'replace', regions: [] },
        trackId,
      });
    } catch (cause) {
      this.removeTrack(trackId);
      throw cause;
    }
  }

  removeTrack(trackId: string): void {
    this.ensureRuntimeReady();
    const automationLanes = this.automationLanes.get(trackId) ?? [];
    this.midiRuntime.removeTrack(trackId);
    this.automationRuntime.clearTargets([{ automationLanes, trackId }]);
    if (this.recordingState.armedTrackIds.includes(trackId)) {
      if (this.activeRecordingRequest) {
        this.recordingRuntime?.cancelRecording();
      }
      this.activeRecordingRequest = null;
      this.updateRecordingState({
        armedTrackIds: this.recordingState.armedTrackIds.filter(armedTrackId => armedTrackId !== trackId),
        inputRoutes: this.recordingState.inputRoutes.filter(route => route.trackId !== trackId),
        phase: 'idle',
        recordStartTimeSeconds: null,
      });
    }
    this.loopRuntime.clearTrack(trackId);
    const previousLiveInputState = this.getLiveInputState();
    if (this.monitoringTrackId === trackId) {
      this.monitoringTrackId = null;
    }
    this.notifyLiveInputStateChange(previousLiveInputState);
    const hadTrack = this.trackInputs.has(trackId) || this.channels.has(trackId) || this.players.has(trackId);
    if (hadTrack) {
      this.graphRevision += 1;
    }
    const trackPlayers = this.players.get(trackId);
    trackPlayers?.forEach(entry => entry.players.forEach(player => this.disposePlayer(player)));
    this.players.delete(trackId);

    this.disconnectSidechainsForTrack(trackId);

    this.routingRuntime.apply(
      removeTrackFromRoutingGraph(this.routingRuntime.getSnapshot(), trackId),
      this.createRoutingTrackNodes(this.captureActiveGraph()),
      this.output
    );

    this.pluginRuntimes
      .get(trackId)
      ?.forEach(runtime => this.disposePluginRuntimeSafely(runtime, '제거한 Track의 Plugin 정리에 실패했습니다.'));
    this.pluginRuntimes.delete(trackId);
    this.disabledPluginInstanceIds.delete(trackId);
    this.pluginRuntimeStates.delete(trackId);
    this.pluginSidechainSourceTrackIds.delete(trackId);

    const meterRuntime = this.trackMeterRuntimes.get(trackId);
    if (meterRuntime) {
      this.disposeMeterRuntimeSafely(meterRuntime, '제거한 Track의 Meter 정리에 실패했습니다.');
    }
    this.trackMeterRuntimes.delete(trackId);

    const input = this.trackInputs.get(trackId);
    if (input) {
      this.disposeTrackInput(input);
    }
    this.trackInputs.delete(trackId);

    const preFaderOutput = this.preFaderOutputs.get(trackId);
    if (preFaderOutput) {
      this.disposeTrackInput(preFaderOutput);
    }
    this.preFaderOutputs.delete(trackId);

    const postFaderOutput = this.postFaderOutputs.get(trackId);
    if (postFaderOutput) {
      this.disposeTrackInput(postFaderOutput);
    }
    this.postFaderOutputs.delete(trackId);

    const channel = this.channels.get(trackId);
    if (channel) {
      this.disposeChannel(channel);
    }
    this.channels.delete(trackId);
    this.desiredTrackVolumes.delete(trackId);
    this.desiredTrackPans.delete(trackId);
    this.automationLanes.delete(trackId);
    this.mutedTrackIds.delete(trackId);
    this.soloedTrackIds.delete(trackId);
    this.applyGraphAudibility(this.captureActiveGraph());
  }

  setTrackVolume(trackId: string, volume: number): void {
    this.ensureRuntimeReady();
    this.getOrInitChannel(trackId);
    this.graphRevision += 1;
    this.desiredTrackVolumes.set(trackId, volume);
    const graph = this.captureActiveGraph();
    this.getVolumeAffectedTrackIds(graph, trackId).forEach(affectedTrackId => {
      if (this.isTrackMutedInGraph(graph, affectedTrackId)) {
        return;
      }
      graph.channels
        .get(affectedTrackId)
        ?.volume.rampTo(Tone.gainToDb(this.getEffectiveTrackVolume(graph, affectedTrackId)), 0.1);
    });
    this.automationRuntime.refresh();
  }

  setTrackPan(trackId: string, pan: number): void {
    this.ensureRuntimeReady();
    const channel = this.getOrInitChannel(trackId);
    this.graphRevision += 1;
    this.desiredTrackPans.set(trackId, pan);
    channel.pan.rampTo(pan, 0.1);
    this.automationRuntime.refresh();
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
    this.automationRuntime.refresh();
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
    this.automationRuntime.refresh();
  }

  getTrackParams(trackId: string): { volume: number; pan: number } | null {
    this.ensureRuntimeReady();
    const channel = this.channels.get(trackId);
    if (!channel) {
      return null;
    }

    return {
      volume: this.desiredTrackVolumes.get(trackId) ?? Tone.dbToGain(channel.volume.value),
      pan: this.desiredTrackPans.get(trackId) ?? channel.pan.value,
    };
  }

  setAutomationLanes(request: SetAutomationLanesRequest): void {
    this.ensureRuntimeReady();
    this.getExistingChannel(request.trackId);
    const graph = this.captureActiveGraph();
    const previousLanes = graph.automationLanes.get(request.trackId) ?? [];
    const nextLanes = request.automationLanes.map(cloneAutomationLaneState);
    this.automationRuntime.assertTargetsResolvable([{ automationLanes: nextLanes, trackId: request.trackId }]);
    try {
      this.automationRuntime.clearTargets([{ automationLanes: previousLanes, trackId: request.trackId }]);
      graph.automationLanes.set(request.trackId, nextLanes);
      this.automationRuntime.refresh();
    } catch (cause) {
      graph.automationLanes.set(request.trackId, previousLanes);
      try {
        this.automationRuntime.refresh();
      } catch (compensationCause) {
        throw new AudioEngineError(
          AudioEngineErrorCode.AUTOMATION_UPDATE_FAILED,
          ERROR_MESSAGES[AudioEngineErrorCode.AUTOMATION_UPDATE_FAILED],
          {
            cause: this.describeError(cause),
            compensationCause: this.describeError(compensationCause),
            trackId: request.trackId,
          }
        );
      }
      throw cause;
    }
    this.graphRevision += 1;
  }

  setMidiTrackState(request: SetMidiTrackStateRequest): void {
    this.ensureRuntimeReady();
    this.midiRuntime.setTrackState({
      destination: this.getExistingInput(request.trackId),
      midi: request.midi,
      trackId: request.trackId,
    });
    this.graphRevision += 1;
  }

  sendMidiInputEvent(request: SendMidiInputEventRequest): void {
    this.ensureRuntimeReady();
    this.midiRuntime.sendInputEvent(request);
  }

  midiPanic(): void {
    this.ensureRuntimeReady();
    this.midiRuntime.panic();
  }

  installPlugin(request: InstallAudioPluginRequest): void {
    this.ensureRuntimeReady();
    const input = this.getExistingInput(request.trackId);
    const destination = this.getExistingPreFaderOutput(request.trackId);
    const currentRuntimes = this.getTrackPluginRuntimes(request.trackId);
    const currentRuntimeStates = this.pluginRuntimeStates.get(request.trackId) ?? [];
    if (currentRuntimeStates.some(state => state.instanceId === request.instanceId)) {
      throw new AudioEngineError(
        AudioEngineErrorCode.PLUGIN_INSTANCE_ID_CONFLICT,
        ERROR_MESSAGES.PLUGIN_INSTANCE_ID_CONFLICT,
        { instanceId: request.instanceId, trackId: request.trackId }
      );
    }

    const targetIndex = request.targetIndex ?? currentRuntimeStates.length;
    this.validatePluginTargetIndex({ ...request, targetIndex, maximumIndex: currentRuntimeStates.length });

    const factory = this.pluginRuntimeFactories.get(request.manifestId);
    if (!factory) {
      throw new AudioEngineError(
        AudioEngineErrorCode.PLUGIN_FACTORY_NOT_FOUND,
        ERROR_MESSAGES.PLUGIN_FACTORY_NOT_FOUND,
        { manifestId: request.manifestId }
      );
    }

    const runtime = this.createPluginRuntime(factory, request);
    const precedingInstanceIds = new Set(currentRuntimeStates.slice(0, targetIndex).map(state => state.instanceId));
    const runtimeTargetIndex = currentRuntimes.filter(candidate =>
      precedingInstanceIds.has(candidate.instanceId)
    ).length;
    const nextRuntimes = insertArrayEntry({
      entries: currentRuntimes,
      entry: runtime,
      targetIndex: runtimeTargetIndex,
    });
    const currentDisabledIds = this.getTrackDisabledPluginInstanceIds(request.trackId);
    const nextDisabledIds = new Set(currentDisabledIds);
    if (request.isEnabled === false) {
      nextDisabledIds.add(request.instanceId);
    }
    this.replacePluginChainConnections({
      trackId: request.trackId,
      input,
      destination,
      previousRuntimes: getEnabledPluginRuntimes(currentRuntimes, currentDisabledIds),
      nextRuntimes: getEnabledPluginRuntimes(nextRuntimes, nextDisabledIds),
      runtimesToDisposeOnRollback: [runtime],
    });
    this.pluginRuntimes.set(request.trackId, nextRuntimes);
    this.disabledPluginInstanceIds.set(request.trackId, nextDisabledIds);
    this.pluginRuntimeStates.set(
      request.trackId,
      insertArrayEntry({
        entries: currentRuntimeStates,
        entry: {
          instanceId: request.instanceId,
          latencySamples: runtime.latencySamples ?? 0,
          reason: null,
          status: request.isEnabled === false ? 'bypassed' : 'active',
        },
        targetIndex,
      })
    );
    this.pluginSidechainSourceTrackIds.set(
      request.trackId,
      this.pluginSidechainSourceTrackIds.get(request.trackId) ?? new Map()
    );
    if (request.sidechainSourceTrackId) {
      try {
        this.setPluginSidechain({
          trackId: request.trackId,
          instanceId: request.instanceId,
          sourceTrackId: request.sidechainSourceTrackId,
        });
      } catch (cause) {
        this.removePlugin(request.trackId, request.instanceId);
        throw cause;
      }
    }
    this.graphRevision += 1;
  }

  removePlugin(trackId: string, instanceId: string): void {
    this.ensureRuntimeReady();
    const input = this.getExistingInput(trackId);
    const destination = this.getExistingPreFaderOutput(trackId);
    const currentRuntimes = this.getTrackPluginRuntimes(trackId);
    const runtimeStates = this.pluginRuntimeStates.get(trackId) ?? [];
    if (!runtimeStates.some(state => state.instanceId === instanceId)) {
      throw new AudioEngineError(
        AudioEngineErrorCode.PLUGIN_INSTANCE_NOT_FOUND,
        ERROR_MESSAGES.PLUGIN_INSTANCE_NOT_FOUND,
        { instanceId, trackId }
      );
    }
    const runtimeIndex = currentRuntimes.findIndex(runtime => runtime.instanceId === instanceId);
    if (runtimeIndex < 0) {
      this.pluginRuntimeStates.set(
        trackId,
        runtimeStates.filter(state => state.instanceId !== instanceId)
      );
      this.getTrackDisabledPluginInstanceIds(trackId).delete(instanceId);
      this.graphRevision += 1;
      return;
    }

    const runtime = currentRuntimes[runtimeIndex];
    const sidechainSourceTrackId = this.pluginSidechainSourceTrackIds.get(trackId)?.get(instanceId);
    if (runtime?.sidechainInputNode && sidechainSourceTrackId) {
      this.postFaderOutputs.get(sidechainSourceTrackId)?.disconnect(runtime.sidechainInputNode);
    }
    this.pluginSidechainSourceTrackIds.get(trackId)?.delete(instanceId);
    const nextRuntimes = currentRuntimes.filter((_, index) => index !== runtimeIndex);
    const currentDisabledIds = this.getTrackDisabledPluginInstanceIds(trackId);
    const nextDisabledIds = new Set(currentDisabledIds);
    nextDisabledIds.delete(instanceId);
    this.replacePluginChainConnections({
      trackId,
      input,
      destination,
      previousRuntimes: getEnabledPluginRuntimes(currentRuntimes, currentDisabledIds),
      nextRuntimes: getEnabledPluginRuntimes(nextRuntimes, nextDisabledIds),
      runtimesToDisposeOnRollback: [],
    });
    this.pluginRuntimes.set(trackId, nextRuntimes);
    this.disabledPluginInstanceIds.set(trackId, nextDisabledIds);
    this.pluginRuntimeStates.set(
      trackId,
      (this.pluginRuntimeStates.get(trackId) ?? []).filter(state => state.instanceId !== instanceId)
    );
    this.graphRevision += 1;
    if (runtime) {
      this.disposePluginRuntimeSafely(runtime, '제거한 Plugin runtime 정리에 실패했습니다.');
    }
  }

  movePlugin(request: MoveAudioPluginRequest): void {
    this.ensureRuntimeReady();
    const input = this.getExistingInput(request.trackId);
    const destination = this.getExistingPreFaderOutput(request.trackId);
    const currentRuntimes = this.getTrackPluginRuntimes(request.trackId);
    const currentRuntimeStates = this.pluginRuntimeStates.get(request.trackId) ?? [];
    const sourceIndex = currentRuntimeStates.findIndex(state => state.instanceId === request.instanceId);
    if (sourceIndex < 0) {
      throw new AudioEngineError(
        AudioEngineErrorCode.PLUGIN_INSTANCE_NOT_FOUND,
        ERROR_MESSAGES.PLUGIN_INSTANCE_NOT_FOUND,
        { instanceId: request.instanceId, trackId: request.trackId }
      );
    }
    this.validatePluginTargetIndex({ ...request, maximumIndex: currentRuntimeStates.length - 1 });
    if (sourceIndex === request.targetIndex) {
      return;
    }

    const nextRuntimeStates = moveArrayEntry({
      entries: currentRuntimeStates,
      sourceIndex,
      targetIndex: request.targetIndex,
    });
    const runtimesById = new Map(currentRuntimes.map(runtime => [runtime.instanceId, runtime]));
    const nextRuntimes = nextRuntimeStates.flatMap(state => {
      const runtime = runtimesById.get(state.instanceId);
      return runtime ? [runtime] : [];
    });
    const disabledInstanceIds = this.getTrackDisabledPluginInstanceIds(request.trackId);
    this.replacePluginChainConnections({
      trackId: request.trackId,
      input,
      destination,
      previousRuntimes: getEnabledPluginRuntimes(currentRuntimes, disabledInstanceIds),
      nextRuntimes: getEnabledPluginRuntimes(nextRuntimes, disabledInstanceIds),
      runtimesToDisposeOnRollback: [],
    });
    this.pluginRuntimes.set(request.trackId, nextRuntimes);
    this.pluginRuntimeStates.set(request.trackId, nextRuntimeStates);
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

  setPluginSidechain(request: SetAudioPluginSidechainRequest): void {
    this.ensureRuntimeReady();
    if (request.sourceTrackId === request.trackId) {
      throw this.createPluginSidechainError(request, 'Sidechain source는 대상 Track과 달라야 합니다.');
    }

    const runtime = this.getTrackPluginRuntimes(request.trackId).find(
      candidate => candidate.instanceId === request.instanceId
    );
    const sidechainInput = runtime?.sidechainInputNode;
    if (!runtime || !sidechainInput) {
      throw this.createPluginSidechainError(request, 'Plugin runtime이 sidechain 입력을 제공하지 않습니다.');
    }

    const sources = this.pluginSidechainSourceTrackIds.get(request.trackId) ?? new Map<string, string>();
    const previousSourceTrackId = sources.get(request.instanceId) ?? null;
    if (previousSourceTrackId === request.sourceTrackId) {
      return;
    }

    const previousSource = previousSourceTrackId ? this.postFaderOutputs.get(previousSourceTrackId) : undefined;
    const nextSource = request.sourceTrackId ? this.postFaderOutputs.get(request.sourceTrackId) : undefined;
    if (request.sourceTrackId && !nextSource) {
      throw new AudioEngineError(AudioEngineErrorCode.TRACK_NOT_FOUND, ERROR_MESSAGES.TRACK_NOT_FOUND, {
        trackId: request.sourceTrackId,
      });
    }

    try {
      previousSource?.disconnect(sidechainInput);
      nextSource?.connect(sidechainInput);
    } catch (cause) {
      try {
        nextSource?.disconnect(sidechainInput);
        previousSource?.connect(sidechainInput);
      } catch {
        // 복구 실패는 원래 sidechain 변경 오류의 세부 정보로만 노출한다.
      }
      throw this.createPluginSidechainError(request, this.describeError(cause));
    }

    if (request.sourceTrackId === null) {
      sources.delete(request.instanceId);
    } else {
      sources.set(request.instanceId, request.sourceTrackId);
    }
    this.pluginSidechainSourceTrackIds.set(request.trackId, sources);
    this.graphRevision += 1;
  }

  setPluginEnabled(request: SetAudioPluginEnabledRequest): void {
    this.ensureRuntimeReady();
    const input = this.getExistingInput(request.trackId);
    const destination = this.getExistingPreFaderOutput(request.trackId);
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
      destination,
      previousRuntimes: getEnabledPluginRuntimes(runtimes, currentDisabledIds),
      nextRuntimes: getEnabledPluginRuntimes(runtimes, nextDisabledIds),
      runtimesToDisposeOnRollback: [],
    });
    this.disabledPluginInstanceIds.set(request.trackId, nextDisabledIds);
    this.pluginRuntimeStates.set(
      request.trackId,
      (this.pluginRuntimeStates.get(request.trackId) ?? []).map(state =>
        state.instanceId === request.instanceId
          ? { ...state, status: request.isEnabled ? ('active' as const) : ('bypassed' as const) }
          : state
      )
    );
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

    const schedulingRegions = [...trackPlayers.values()].map(candidate => candidate.regionData).concat(regionData);
    const [entry] = await this.createScheduledRegionEntries({
      input,
      regions: [regionData],
      schedulingRegions,
    });
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

    if (regionData.isOpaque) {
      let nextEntries: RegionPlayerEntry[];
      try {
        nextEntries = this.createRescheduledTrackRegionEntries({
          input,
          loadedEntries: [entry],
          regions: schedulingRegions,
          trackPlayers,
        });
      } catch (error) {
        this.cleanupRegionEntries([entry]);
        throw error;
      }
      this.cleanupRegionEntries([entry]);
      this.replaceActiveTrackRegionEntries(trackPlayers, nextEntries);
    } else {
      trackPlayers.set(entry.regionData.id, entry);
    }
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
    if (!entry.regionData.isOpaque || !trackPlayers) {
      entry.players.forEach(player => this.disposePlayer(player));
      trackPlayers?.delete(regionId);
      return;
    }

    const input = this.getExistingInput(trackId);
    const remainingRegions = [...trackPlayers.values()]
      .filter(candidate => candidate.regionData.id !== regionId)
      .map(candidate => candidate.regionData);
    const nextEntries = this.createRescheduledTrackRegionEntries({
      input,
      regions: remainingRegions,
      trackPlayers,
    });
    this.replaceActiveTrackRegionEntries(trackPlayers, nextEntries);
  }

  rescheduleRegion(request: RescheduleRegionRequest): void {
    this.ensureRuntimeReady();
    const trackPlayers = this.players.get(request.trackId);
    const entry = this.getRegionEntry(request);
    const input = this.getExistingInput(request.trackId);
    this.graphRevision += 1;
    const nextRegionData = this.cloneRegionData({ ...entry.regionData, startTime: request.startTime });
    const nextTrackRegions = [...(trackPlayers?.values() ?? [])].map(candidate =>
      candidate.regionData.id === request.regionId ? nextRegionData : candidate.regionData
    );
    if (entry.regionData.isOpaque && trackPlayers) {
      const nextEntries = this.createRescheduledTrackRegionEntries({
        input,
        regions: nextTrackRegions,
        trackPlayers,
        updatedEntries: new Map([[request.regionId, { ...entry, regionData: nextRegionData }]]),
      });
      this.replaceActiveTrackRegionEntries(trackPlayers, nextEntries);
      return;
    }

    const nextEntry = this.createRegionEntryFromBuffer({
      buffer: entry.players[0]?.buffer,
      input,
      regionData: nextRegionData,
      regions: nextTrackRegions,
      revision: entry.revision + 1,
    });

    try {
      this.scheduleEntryPlayers(nextEntry);
    } catch (error) {
      this.cleanupRegionEntries([nextEntry]);
      throw new AudioEngineError(AudioEngineErrorCode.REGION_SCHEDULE_FAILED, ERROR_MESSAGES.REGION_SCHEDULE_FAILED, {
        cause: this.describeError(error),
      });
    }

    entry.players.forEach(player => this.disposePlayer(player));
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
    const schedulingRegions = [...trackPlayers.values()]
      .filter(entry => entry.regionData.id !== request.regionId)
      .map(entry => entry.regionData)
      .concat(request.replacements);
    const replacementEntries = await this.createScheduledRegionEntries({
      input,
      regions: request.replacements,
      schedulingRegions,
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

    const requiresTrackReschedule =
      originalEntry.regionData.isOpaque || request.replacements.some(replacement => replacement.isOpaque);
    if (requiresTrackReschedule) {
      let nextEntries: RegionPlayerEntry[];
      try {
        nextEntries = this.createRescheduledTrackRegionEntries({
          input,
          loadedEntries: replacementEntries,
          regions: schedulingRegions,
          trackPlayers,
        });
      } catch (error) {
        this.cleanupRegionEntries(replacementEntries);
        throw error;
      }
      this.cleanupRegionEntries(replacementEntries);
      this.replaceActiveTrackRegionEntries(trackPlayers, nextEntries);
    } else {
      originalEntry.players.forEach(player => this.disposePlayer(player));
      trackPlayers.delete(request.regionId);
      replacementEntries.forEach(entry => trackPlayers.set(entry.regionData.id, entry));
    }
    this.graphRevision += 1;
  }

  async prepareProjectGraph({
    tracks,
    masterVolume = 1,
    routingGraph = createDefaultRoutingGraphSnapshot(tracks.map(track => track.id)),
  }: PrepareAudioProjectGraphRequest): Promise<IPreparedAudioProjectGraph> {
    this.ensureRuntimeReady();
    this.retryPendingCleanup();
    const expectedRevision = this.graphRevision;
    const preparedGraph = await this.createPreparedProjectGraph(tracks, masterVolume, routingGraph);
    let preparedLoops: IPreparedLoopRuntimeReplacement;
    try {
      preparedLoops = await this.loopRuntime.prepareReplacement(this.createPreparedLoopRequests(tracks, preparedGraph));
    } catch (cause) {
      this.disposeGraph(preparedGraph, '루프 준비에 실패한 프로젝트 그래프 정리에 실패했습니다.');
      throw cause;
    }
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
      preparedLoops.assertActivatable();
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
          preparedLoops.discard();
          throw cause;
        }
        const retiredLoops = preparedLoops.activate();
        if (this.activeRecordingRequest) {
          this.recordingRuntime?.cancelRecording();
        }
        this.activeRecordingRequest = null;
        this.updateRecordingState({ armedTrackIds: [], inputRoutes: [], phase: 'idle', recordStartTimeSeconds: null });
        const previousLiveInputState = this.getLiveInputState();
        this.monitoringTrackId = null;
        this.notifyLiveInputStateChange(previousLiveInputState);
        this.graphRevision += 1;
        state = 'activated';
        retiredGraph = this.createRetiredGraph(previousGraph, retiredLoops);
        return retiredGraph;
      },
      discard: () => {
        if (state === 'activated') {
          return COMPLETE_RESOURCE_CLEANUP;
        }

        state = 'discarded';
        return this.combineCleanupResults(
          this.disposeGraph(preparedGraph, '준비한 프로젝트 그래프 정리에 실패했습니다.'),
          preparedLoops.discard()
        );
      },
    };
  }

  async exportProject(request: ExportRequest): Promise<Blob> {
    try {
      const audioBuffer = await this.renderExportAudioBuffer(request);
      return this.analyzeNormalizeAndEncode(audioBuffer, request.preset ?? createDefaultExportPreset()).blob;
    } catch (error) {
      if (error instanceof AudioEngineError) {
        throw error;
      }
      throw new AudioEngineError(AudioEngineErrorCode.EXPORT_FAILED, ERROR_MESSAGES.EXPORT_FAILED, {
        cause: this.describeError(error),
      });
    }
  }

  async startRenderJob(request: StartRenderJobRequest): Promise<RenderJobResult> {
    if (this.activeRenderJobId !== null) {
      throw new AudioEngineError(AudioEngineErrorCode.RENDER_JOB_ACTIVE, ERROR_MESSAGES.RENDER_JOB_ACTIVE, {
        activeJobId: this.renderJobState.jobId,
      });
    }
    const outputs = this.createRenderJobOutputs(request);
    this.activeRenderJobId = request.jobId;
    this.cancelledRenderJobId = null;
    this.updateRenderJobState({
      completedFileCount: 0,
      errorMessage: null,
      jobId: request.jobId,
      outputFileCount: outputs.length,
      progress: 0,
      stage: 'preparing',
      status: 'running',
    });

    const files: RenderJobFile[] = [];
    try {
      for (const output of outputs) {
        this.assertRenderJobNotCancelled(request.jobId);
        this.updateRenderJobState({ ...this.renderJobState, stage: 'rendering' });
        const audioBuffer = await this.renderExportAudioBuffer(output.request);
        this.assertRenderJobNotCancelled(request.jobId);
        this.updateRenderJobState({ ...this.renderJobState, stage: 'analyzing' });
        const renderedFile = this.analyzeNormalizeAndEncode(audioBuffer, request.preset);
        this.assertRenderJobNotCancelled(request.jobId);
        files.push({
          ...renderedFile,
          fileName: output.fileName,
          rangeId: output.range.id,
          trackId: output.trackId,
        });
        this.updateRenderJobState({
          ...this.renderJobState,
          completedFileCount: files.length,
          progress: files.length / outputs.length,
          stage: 'encoding',
        });
      }
      this.updateRenderJobState({ ...this.renderJobState, progress: 1, stage: 'encoding', status: 'completed' });
      return { files, jobId: request.jobId };
    } catch (cause) {
      if (this.cancelledRenderJobId === request.jobId) {
        this.updateRenderJobState({ ...this.renderJobState, errorMessage: null, status: 'cancelled' });
        throw new AudioEngineError(AudioEngineErrorCode.RENDER_JOB_CANCELLED, ERROR_MESSAGES.RENDER_JOB_CANCELLED, {
          jobId: request.jobId,
        });
      }
      const errorMessage = this.describeError(cause);
      this.updateRenderJobState({ ...this.renderJobState, errorMessage, status: 'failed' });
      throw cause;
    } finally {
      if (this.activeRenderJobId === request.jobId) {
        this.activeRenderJobId = null;
      }
    }
  }

  cancelRenderJob(jobId: string): void {
    if (this.renderJobState.status !== 'running' || this.renderJobState.jobId !== jobId) {
      return;
    }
    this.cancelledRenderJobId = jobId;
    this.updateRenderJobState({ ...this.renderJobState, status: 'cancelled' });
  }

  getRenderJobState(): RenderJobState {
    return { ...this.renderJobState };
  }

  subscribeRenderJobState(listener: RenderJobStateListener): () => void {
    this.renderJobStateListeners.add(listener);
    return () => this.renderJobStateListeners.delete(listener);
  }

  private async renderExportAudioBuffer(request: ExportRequest): Promise<AudioBuffer> {
    const duration = request.range.endTime - request.range.startTime;
    if (duration <= 0) {
      throw new AudioEngineError(AudioEngineErrorCode.EXPORT_ZERO_DURATION, ERROR_MESSAGES.EXPORT_ZERO_DURATION);
    }
    if (request.tracks.length === 0) {
      throw new AudioEngineError(AudioEngineErrorCode.EXPORT_NO_TRACKS, ERROR_MESSAGES.EXPORT_NO_TRACKS);
    }
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
    return audioBuffer;
  }

  private analyzeNormalizeAndEncode(
    audioBuffer: AudioBuffer,
    preset: ExportPresetState
  ): Pick<RenderJobFile, 'analysis' | 'blob'> {
    const channels = Array.from({ length: audioBuffer.numberOfChannels }, (_, channelIndex) =>
      audioBuffer.getChannelData(channelIndex)
    );
    const initialAnalysis = analyzeRenderedPcm({ channels, sampleRate: audioBuffer.sampleRate });
    const normalizationGainDb = calculateNormalizationGainDb({
      analysis: initialAnalysis,
      normalization: preset.normalization,
    });
    if (normalizationGainDb !== 0) {
      const gain = 10 ** (normalizationGainDb / 20);
      channels.forEach(channel => {
        for (let index = 0; index < channel.length; index += 1) {
          channel[index] = (channel[index] ?? 0) * gain;
        }
      });
    }
    const normalizedAnalysis =
      normalizationGainDb === 0
        ? initialAnalysis
        : analyzeRenderedPcm({ channels, sampleRate: audioBuffer.sampleRate });
    const analysis = { ...normalizedAnalysis, normalizationGainDb };
    return {
      analysis,
      blob: encodeAudioBufferToWav(audioBuffer, {
        channelMode: preset.channelMode,
        dither: preset.sampleFormat === 'float32' ? 'none' : preset.dither,
        sampleFormat: preset.sampleFormat,
      }),
    };
  }

  private createRenderJobOutputs(request: StartRenderJobRequest): RenderJobOutput[] {
    const ranges = request.ranges.filter(range => range.endTimeSeconds > range.startTimeSeconds);
    const createRequest = (
      range: ExportRangeState,
      tracks: ExportTrack[],
      routingGraph?: RoutingGraphSnapshot
    ): ExportRequest => ({
      masterVolume: request.masterVolume,
      preset: request.preset,
      range: { endTime: range.endTimeSeconds, startTime: range.startTimeSeconds },
      ...(routingGraph ? { routingGraph } : {}),
      sampleRate: request.preset.sampleRate,
      tracks,
    });
    const outputs: RenderJobOutput[] = [];
    ranges.forEach(range => {
      if (request.preset.exportMode === 'mix') {
        outputs.push({
          fileName: `${this.toSafeFileName(range.name)}.wav`,
          range,
          request: createRequest(range, [...request.tracks], request.routingGraph),
          trackId: null,
        });
        return;
      }
      request.tracks.forEach(track => {
        outputs.push({
          fileName: `${this.toSafeFileName(range.name)}-${this.toSafeFileName(track.id)}.wav`,
          range,
          request: createRequest(range, [{ ...track, isMuted: false, isSoloed: false }]),
          trackId: track.id,
        });
      });
    });
    if (outputs.length === 0) {
      throw new AudioEngineError(AudioEngineErrorCode.EXPORT_ZERO_DURATION, ERROR_MESSAGES.EXPORT_ZERO_DURATION);
    }
    return outputs;
  }

  private toSafeFileName(value: string): string {
    const printableValue = [...value.trim()]
      .map(character => (character.charCodeAt(0) < 32 ? '-' : character))
      .join('');
    const safeValue = printableValue.replace(/[<>:"/\\|?*]/g, '-');
    return safeValue || 'export';
  }

  private assertRenderJobNotCancelled(jobId: string): void {
    if (this.cancelledRenderJobId === jobId) {
      throw new AudioEngineError(AudioEngineErrorCode.RENDER_JOB_CANCELLED, ERROR_MESSAGES.RENDER_JOB_CANCELLED, {
        jobId,
      });
    }
  }

  private updateRenderJobState(state: RenderJobState): void {
    this.renderJobState = { ...state };
    this.renderJobStateListeners.forEach(listener => listener({ ...this.renderJobState }));
  }

  async analyzeAudioRegionPeak(request: AnalyzeAudioRegionPeakRequest): Promise<number> {
    try {
      const audioBuffer = await this.decodeAudioRegionBlob(request.blob);
      return analyzePcmPeak(this.extractAudioRegionChannels(audioBuffer, request));
    } catch (cause) {
      throw this.createRegionProcessingError(cause);
    }
  }

  async renderDerivedAudioRegion(request: RenderDerivedAudioRegionRequest): Promise<RenderedDerivedAudioRegion> {
    try {
      const sourceBuffer = await this.decodeAudioRegionBlob(request.blob);
      const sourceChannels = this.extractAudioRegionChannels(sourceBuffer, request);
      const outputChannels = createDerivedPcmChannels({ request, sampleRate: sourceBuffer.sampleRate, sourceChannels });
      const frameCount = outputChannels[0]?.length ?? 0;
      if (frameCount === 0) {
        throw new AudioEngineError(
          AudioEngineErrorCode.REGION_PROCESSING_EMPTY_RESULT,
          ERROR_MESSAGES.REGION_PROCESSING_EMPTY_RESULT
        );
      }
      const outputBuffer = Tone.getContext().rawContext.createBuffer(
        outputChannels.length,
        frameCount,
        sourceBuffer.sampleRate
      );
      outputChannels.forEach((channel, channelIndex) => outputBuffer.copyToChannel(channel, channelIndex));
      const transientPositionsSeconds =
        request.operation === 'transientAnalysis'
          ? detectTransientPositionsSeconds({
              channels: outputChannels,
              sampleRate: sourceBuffer.sampleRate,
              sensitivity: request.transientSensitivity ?? 0.75,
            })
          : undefined;
      return {
        blob: encodeAudioBufferToWav(outputBuffer),
        durationSeconds: frameCount / sourceBuffer.sampleRate,
        ...(transientPositionsSeconds ? { transientPositionsSeconds } : {}),
      };
    } catch (cause) {
      if (cause instanceof AudioEngineError) {
        throw cause;
      }
      throw this.createRegionProcessingError(cause);
    }
  }

  async auditionAudioSource({ blob }: AuditionAudioSourceRequest): Promise<void> {
    this.stopAudioSourceAudition();
    const auditionRevision = ++this.sourceAuditionRevision;
    try {
      await Tone.start();
      const audioBuffer = await this.decodeAudioRegionBlob(blob);
      if (auditionRevision !== this.sourceAuditionRevision) {
        return;
      }
      const player = new Tone.Player({ url: audioBuffer }).connect(Tone.getDestination());
      player.onstop = () => {
        if (this.sourceAuditionPlayer !== player) {
          return;
        }
        this.sourceAuditionPlayer = null;
        player.dispose();
      };
      this.sourceAuditionPlayer = player;
      try {
        player.start();
      } catch (cause) {
        this.sourceAuditionPlayer = null;
        player.dispose();
        throw cause;
      }
    } catch (cause) {
      throw this.createRegionProcessingError(cause);
    }
  }

  stopAudioSourceAudition(): void {
    this.sourceAuditionRevision += 1;
    const player = this.sourceAuditionPlayer;
    this.sourceAuditionPlayer = null;
    if (!player) {
      return;
    }
    try {
      player.stop();
    } finally {
      player.dispose();
    }
  }

  private getOrInitChannel(trackId: string): Tone.Channel {
    return this.getOrInitTrackNodes(trackId).channel;
  }

  private decodeAudioRegionBlob(blob: Blob): Promise<AudioBuffer> {
    return blob.arrayBuffer().then(arrayBuffer => Tone.getContext().decodeAudioData(arrayBuffer));
  }

  private extractAudioRegionChannels(
    audioBuffer: AudioBuffer,
    request: { readonly durationSeconds: number; readonly sourceStartTimeSeconds: number }
  ): Float32Array[] {
    const startFrame = Math.round(request.sourceStartTimeSeconds * audioBuffer.sampleRate);
    const frameCount = Math.round(request.durationSeconds * audioBuffer.sampleRate);
    const endFrame = startFrame + frameCount;
    if (
      !Number.isSafeInteger(startFrame) ||
      !Number.isSafeInteger(frameCount) ||
      startFrame < 0 ||
      frameCount <= 0 ||
      endFrame > audioBuffer.length
    ) {
      throw new RangeError('Region Source 범위가 디코딩된 오디오 범위를 벗어났습니다.');
    }
    return Array.from({ length: audioBuffer.numberOfChannels }, (_, channelIndex) =>
      audioBuffer.getChannelData(channelIndex).slice(startFrame, endFrame)
    );
  }

  private createRegionProcessingError(cause: unknown): AudioEngineError {
    return new AudioEngineError(
      AudioEngineErrorCode.REGION_PROCESSING_FAILED,
      ERROR_MESSAGES.REGION_PROCESSING_FAILED,
      { cause: this.describeError(cause) }
    );
  }

  private createPluginSidechainError(request: SetAudioPluginSidechainRequest, reason: string): AudioEngineError {
    return new AudioEngineError(
      AudioEngineErrorCode.PLUGIN_SIDECHAIN_UPDATE_FAILED,
      ERROR_MESSAGES[AudioEngineErrorCode.PLUGIN_SIDECHAIN_UPDATE_FAILED],
      { ...request, reason }
    );
  }

  private disconnectSidechainsForTrack(trackId: string): void {
    this.pluginSidechainSourceTrackIds.forEach((sources, targetTrackId) => {
      const runtimes = this.getTrackPluginRuntimes(targetTrackId);
      [...sources.entries()].forEach(([instanceId, sourceTrackId]) => {
        if (targetTrackId !== trackId && sourceTrackId !== trackId) {
          return;
        }
        const runtime = runtimes.find(candidate => candidate.instanceId === instanceId);
        const source = this.postFaderOutputs.get(sourceTrackId);
        if (runtime?.sidechainInputNode && source) {
          source.disconnect(runtime.sidechainInputNode);
        }
        sources.delete(instanceId);
      });
    });
  }

  private createPluginRuntime(
    factory: IAudioPluginRuntimeFactory,
    request: InstallAudioPluginRequest
  ): IAudioPluginRuntime {
    try {
      return factory.create({
        instanceId: request.instanceId,
        parameterValues: request.parameterValues,
        stateBlob: request.stateBlob,
      });
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
  }: CreatePreparedPluginRuntimesRequest): PreparedPluginRuntimeResult {
    const instanceIds = new Set<string>();
    const runtimes: IAudioPluginRuntime[] = [];
    const states: PluginRuntimeState[] = [];

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
          states.push({
            instanceId: instance.instanceId,
            latencySamples: 0,
            reason: `Plugin runtime을 찾을 수 없습니다: ${instance.manifestId}`,
            status: 'missing',
          });
          continue;
        }

        try {
          const runtime = this.createPluginRuntime(factory, {
            trackId,
            instanceId: instance.instanceId,
            manifestId: instance.manifestId,
            parameterValues: instance.parameterValues,
            stateBlob: instance.stateBlob,
          });
          if (instance.sidechainSourceTrackId && !runtime.sidechainInputNode) {
            this.disposePluginRuntimeSafely(runtime, 'Sidechain 입력이 없는 Plugin runtime 정리에 실패했습니다.');
            states.push({
              instanceId: instance.instanceId,
              latencySamples: 0,
              reason: 'Plugin runtime이 저장된 sidechain 입력을 제공하지 않습니다.',
              status: 'failed',
            });
            continue;
          }
          runtimes.push(runtime);
          states.push({
            instanceId: instance.instanceId,
            latencySamples: runtime.latencySamples ?? 0,
            reason: null,
            status: instance.isEnabled ? 'active' : 'bypassed',
          });
        } catch (cause) {
          states.push({
            instanceId: instance.instanceId,
            latencySamples: 0,
            reason: this.describeError(cause),
            status: 'failed',
          });
        }
      }

      return { runtimes, states };
    } catch (error) {
      runtimes.forEach(runtime =>
        this.disposePluginRuntimeSafely(runtime, '프로젝트 준비 중 만든 Plugin runtime 정리에 실패했습니다.')
      );
      throw error;
    }
  }

  private connectPreparedPluginChain({
    input,
    destination,
    runtimes,
    trackId,
  }: ConnectPreparedPluginChainRequest): void {
    if (runtimes.length === 0) {
      input.connect(destination);
      return;
    }

    try {
      this.rebuildPluginChainConnections({
        input,
        destination,
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
    destination,
    previousRuntimes,
    nextRuntimes,
    runtimesToDisposeOnRollback,
  }: ReplacePluginChainConnectionsRequest): void {
    const involvedRuntimes = getUniquePluginRuntimes([...previousRuntimes, ...nextRuntimes]);
    try {
      this.rebuildPluginChainConnections({ input, destination, targetRuntimes: nextRuntimes, involvedRuntimes });
      return;
    } catch (cause) {
      const recoveryState: PluginChainRecoveryState = {
        trackId,
        input,
        destination,
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
    destination,
    targetRuntimes,
    involvedRuntimes,
  }: RebuildPluginChainConnectionsRequest): void {
    input.disconnect();
    involvedRuntimes.forEach(runtime => runtime.disconnect());
    const firstRuntime = targetRuntimes[0];
    if (!firstRuntime) {
      input.connect(destination);
      return;
    }

    input.connect(firstRuntime.inputNode);
    targetRuntimes.forEach((runtime, index) => {
      const nextRuntime = targetRuntimes[index + 1];
      runtime.connect(nextRuntime?.inputNode ?? destination);
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
    const currentPreFaderOutput = this.preFaderOutputs.get(trackId);
    const currentPostFaderOutput = this.postFaderOutputs.get(trackId);
    if (currentInput && currentChannel && currentPreFaderOutput && currentPostFaderOutput) {
      return { input: currentInput, channel: currentChannel };
    }
    if (currentInput || currentChannel || currentPreFaderOutput || currentPostFaderOutput) {
      throw new AudioEngineError(AudioEngineErrorCode.TRACK_INIT_FAILED, ERROR_MESSAGES.TRACK_INIT_FAILED, {
        reason: 'TRACK_NODE_STATE_INCONSISTENT',
        trackId,
      });
    }

    const input = new Tone.Gain({ gain: 1 });
    const preFaderOutput = new Tone.Gain({ gain: 1 });
    const channel = new Tone.Channel({
      volume: 0,
      pan: 0,
    });
    const postFaderOutput = new Tone.Gain({ gain: 1 });
    let meterRuntime: IAudioMeterRuntime | null = null;

    try {
      input.connect(preFaderOutput);
      preFaderOutput.connect(channel);
      channel.connect(postFaderOutput);
      meterRuntime = this.meterRuntimeFactory.create(channel);
    } catch (cause) {
      if (meterRuntime) {
        this.disposeMeterRuntimeSafely(meterRuntime, '연결에 실패한 Track Meter 정리에 실패했습니다.');
      }
      this.disposeTrackInputSafely(input, '연결에 실패한 Track input 정리에 실패했습니다.');
      this.disposeTrackInputSafely(preFaderOutput, '연결에 실패한 Track pre-fader 출력 정리에 실패했습니다.');
      this.disposeTrackInputSafely(postFaderOutput, '연결에 실패한 Track post-fader 출력 정리에 실패했습니다.');
      this.disposeChannelSafely(channel, '연결에 실패한 Track Channel 정리에 실패했습니다.');
      throw new AudioEngineError(AudioEngineErrorCode.TRACK_INIT_FAILED, ERROR_MESSAGES.TRACK_INIT_FAILED, {
        cause: this.describeError(cause),
        trackId,
      });
    }

    this.trackInputs.set(trackId, input);
    this.preFaderOutputs.set(trackId, preFaderOutput);
    this.postFaderOutputs.set(trackId, postFaderOutput);
    this.channels.set(trackId, channel);
    this.trackMeterRuntimes.set(trackId, meterRuntime);
    this.desiredTrackVolumes.set(trackId, 1);
    this.desiredTrackPans.set(trackId, 0);
    this.automationLanes.set(trackId, []);
    this.players.set(trackId, new Map());
    this.pluginRuntimes.set(trackId, []);
    this.disabledPluginInstanceIds.set(trackId, new Set());
    this.pluginRuntimeStates.set(trackId, []);
    this.pluginSidechainSourceTrackIds.set(trackId, new Map());
    const nextRoutingGraph = {
      ...this.routingRuntime.getSnapshot(),
      routes: [
        ...this.routingRuntime.getSnapshot().routes.filter(route => route.trackId !== trackId),
        ...createDefaultRoutingGraphSnapshot([trackId]).routes,
      ],
    };
    try {
      this.routingRuntime.apply(nextRoutingGraph, this.createRoutingTrackNodes(this.captureActiveGraph()), this.output);
    } catch (cause) {
      this.trackInputs.delete(trackId);
      this.preFaderOutputs.delete(trackId);
      this.postFaderOutputs.delete(trackId);
      this.channels.delete(trackId);
      this.trackMeterRuntimes.delete(trackId);
      this.desiredTrackVolumes.delete(trackId);
      this.desiredTrackPans.delete(trackId);
      this.automationLanes.delete(trackId);
      this.players.delete(trackId);
      this.pluginRuntimes.delete(trackId);
      this.disabledPluginInstanceIds.delete(trackId);
      this.pluginRuntimeStates.delete(trackId);
      this.pluginSidechainSourceTrackIds.delete(trackId);
      this.disposeMeterRuntimeSafely(meterRuntime, 'Route 연결에 실패한 Track Meter 정리에 실패했습니다.');
      this.disposeTrackInputSafely(input, 'Route 연결에 실패한 Track input 정리에 실패했습니다.');
      this.disposeTrackInputSafely(preFaderOutput, 'Route 연결에 실패한 Track pre-fader 출력 정리에 실패했습니다.');
      this.disposeTrackInputSafely(postFaderOutput, 'Route 연결에 실패한 Track post-fader 출력 정리에 실패했습니다.');
      this.disposeChannelSafely(channel, 'Route 연결에 실패한 Track Channel 정리에 실패했습니다.');
      throw new AudioEngineError(AudioEngineErrorCode.TRACK_INIT_FAILED, ERROR_MESSAGES.TRACK_INIT_FAILED, {
        cause: this.describeError(cause),
        trackId,
      });
    }
    this.graphRevision += 1;
    this.applyGraphAudibility(this.captureActiveGraph());
    return { input, channel };
  }

  private async createPreparedProjectGraph(
    tracks: PrepareAudioProjectGraphRequest['tracks'],
    masterVolume: number,
    routingGraph: RoutingGraphSnapshot
  ): Promise<AudioProjectGraphState> {
    const graph = this.createEmptyGraph(masterVolume);

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
        const preFaderOutput = new Tone.Gain({ gain: 1 });
        const channel = new Tone.Channel({
          volume: Tone.gainToDb(track.volume),
          pan: track.pan,
        });
        const postFaderOutput = new Tone.Gain({ gain: 1 });
        graph.trackInputs.set(track.id, input);
        graph.preFaderOutputs.set(track.id, preFaderOutput);
        graph.postFaderOutputs.set(track.id, postFaderOutput);
        graph.channels.set(track.id, channel);
        const preparedPlugins = this.createPreparedPluginRuntimes({
          trackId: track.id,
          pluginInstances: track.pluginInstances,
        });
        const pluginRuntimes = preparedPlugins.runtimes;
        graph.pluginRuntimes.set(track.id, pluginRuntimes);
        graph.pluginRuntimeStates.set(track.id, preparedPlugins.states);
        graph.pluginSidechainSourceTrackIds.set(track.id, new Map());
        const disabledPluginInstanceIds = new Set(
          track.pluginInstances.filter(instance => !instance.isEnabled).map(instance => instance.instanceId)
        );
        graph.disabledPluginInstanceIds.set(track.id, disabledPluginInstanceIds);
        this.connectPreparedPluginChain({
          input,
          destination: preFaderOutput,
          runtimes: getEnabledPluginRuntimes(pluginRuntimes, disabledPluginInstanceIds),
          trackId: track.id,
        });
        preFaderOutput.connect(channel);
        channel.connect(postFaderOutput);
        const meterRuntime = this.meterRuntimeFactory.create(channel);
        graph.trackMeterRuntimes.set(track.id, meterRuntime);
        channel.volume.value = Tone.gainToDb(track.volume);
        channel.pan.value = track.pan;
        graph.desiredTrackVolumes.set(track.id, track.volume);
        graph.desiredTrackPans.set(track.id, track.pan);
        graph.automationLanes.set(track.id, (track.automationLanes ?? []).map(cloneAutomationLaneState));
        if (track.midi) {
          graph.midiRuntime.setTrackState({ destination: input, midi: track.midi, trackId: track.id });
        }
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

      tracks.forEach(track => {
        track.pluginInstances.forEach(instance => {
          if (!instance.sidechainSourceTrackId) {
            return;
          }
          const runtime = graph.pluginRuntimes
            .get(track.id)
            ?.find(candidate => candidate.instanceId === instance.instanceId);
          const sidechainInput = runtime?.sidechainInputNode;
          if (!sidechainInput) {
            return;
          }
          const source = graph.postFaderOutputs.get(instance.sidechainSourceTrackId);
          if (!source) {
            throw new AudioEngineError(AudioEngineErrorCode.TRACK_NOT_FOUND, ERROR_MESSAGES.TRACK_NOT_FOUND, {
              trackId: instance.sidechainSourceTrackId,
            });
          }
          source.connect(sidechainInput);
          graph.pluginSidechainSourceTrackIds.get(track.id)?.set(instance.instanceId, instance.sidechainSourceTrackId);
        });
      });

      graph.routingRuntime.apply(routingGraph, this.createRoutingTrackNodes(graph), graph.output);
      this.assertAutomationTargetsResolvable(graph);
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

  private createPreparedLoopRequests(
    tracks: PrepareAudioProjectGraphRequest['tracks'],
    graph: AudioProjectGraphState
  ): LoadLoopRuntimeRequest[] {
    return tracks.flatMap(track => {
      const destination = graph.trackInputs.get(track.id);
      if (!destination) {
        if ((track.loops ?? []).length === 0) {
          return [];
        }
        throw new AudioEngineError(AudioEngineErrorCode.TRACK_NOT_FOUND, ERROR_MESSAGES.TRACK_NOT_FOUND, {
          trackId: track.id,
        });
      }

      return (track.loops ?? []).map(loop => ({
        destination: destination.input,
        slotId: loop.slotId,
        trackId: track.id,
        url: loop.url,
      }));
    });
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

  private createEmptyGraph(masterVolume: number): AudioProjectGraphState {
    const outputNodes = this.createGraphOutputNodes({
      initialGain: 0,
      monitorState: this.getMonitorState(),
      unmutedGain: masterVolume,
    });
    return {
      output: outputNodes.output,
      monitorMono: outputNodes.monitorMono,
      masterMeterRuntime: outputNodes.meterRuntime,
      trackInputs: new Map(),
      preFaderOutputs: new Map(),
      postFaderOutputs: new Map(),
      trackMeterRuntimes: new Map(),
      channels: new Map(),
      desiredTrackVolumes: new Map(),
      desiredTrackPans: new Map(),
      automationLanes: new Map(),
      mutedTrackIds: new Set(),
      soloedTrackIds: new Set(),
      players: new Map(),
      pluginRuntimes: new Map(),
      disabledPluginInstanceIds: new Map(),
      pluginRuntimeStates: new Map(),
      pluginSidechainSourceTrackIds: new Map(),
      routingRuntime: new AudioRoutingRuntime(),
      midiRuntime: new ToneMidiRuntime(),
    };
  }

  private captureActiveGraph(): AudioProjectGraphState {
    return {
      output: this.output,
      monitorMono: this.monitorMono,
      masterMeterRuntime: this.masterMeterRuntime,
      trackInputs: this.trackInputs,
      preFaderOutputs: this.preFaderOutputs,
      postFaderOutputs: this.postFaderOutputs,
      trackMeterRuntimes: this.trackMeterRuntimes,
      channels: this.channels,
      desiredTrackVolumes: this.desiredTrackVolumes,
      desiredTrackPans: this.desiredTrackPans,
      automationLanes: this.automationLanes,
      mutedTrackIds: this.mutedTrackIds,
      soloedTrackIds: this.soloedTrackIds,
      players: this.players,
      pluginRuntimes: this.pluginRuntimes,
      disabledPluginInstanceIds: this.disabledPluginInstanceIds,
      pluginRuntimeStates: this.pluginRuntimeStates,
      pluginSidechainSourceTrackIds: this.pluginSidechainSourceTrackIds,
      routingRuntime: this.routingRuntime,
      midiRuntime: this.midiRuntime,
    };
  }

  private useGraph(graph: AudioProjectGraphState): void {
    this.output = graph.output;
    this.monitorMono = graph.monitorMono;
    this.masterMeterRuntime = graph.masterMeterRuntime;
    this.trackInputs = graph.trackInputs;
    this.preFaderOutputs = graph.preFaderOutputs;
    this.postFaderOutputs = graph.postFaderOutputs;
    this.trackMeterRuntimes = graph.trackMeterRuntimes;
    this.channels = graph.channels;
    this.desiredTrackVolumes = graph.desiredTrackVolumes;
    this.desiredTrackPans = graph.desiredTrackPans;
    this.automationLanes = graph.automationLanes;
    this.mutedTrackIds = graph.mutedTrackIds;
    this.soloedTrackIds = graph.soloedTrackIds;
    this.players = graph.players;
    this.pluginRuntimes = graph.pluginRuntimes;
    this.disabledPluginInstanceIds = graph.disabledPluginInstanceIds;
    this.pluginRuntimeStates = graph.pluginRuntimeStates;
    this.pluginSidechainSourceTrackIds = graph.pluginSidechainSourceTrackIds;
    this.routingRuntime = graph.routingRuntime;
    this.midiRuntime = graph.midiRuntime;
  }

  private createRetiredGraph(graph: AudioProjectGraphState, loops: IRetiredLoopRuntime): IRetiredAudioProjectGraph {
    this.pendingGraphCleanup.add(graph);

    return {
      dispose: () =>
        this.combineCleanupResults(
          this.disposeGraph(graph, '이전 프로젝트 오디오 그래프 정리에 실패했습니다.'),
          loops.dispose()
        ),
    };
  }

  private combineCleanupResults(...results: readonly ResourceCleanupResult[]): ResourceCleanupResult {
    const failedResourceCount = results.reduce((count, result) => count + result.failedResourceCount, 0);
    return failedResourceCount === 0 ? COMPLETE_RESOURCE_CLEANUP : { failedResourceCount, isComplete: false };
  }

  private disposeGraph(graph: AudioProjectGraphState, errorMessage: string): ResourceCleanupResult {
    this.pendingGraphCleanup.add(graph);
    graph.routingRuntime.dispose();
    graph.pluginSidechainSourceTrackIds.forEach((sources, targetTrackId) => {
      const runtimes = graph.pluginRuntimes.get(targetTrackId) ?? [];
      sources.forEach((sourceTrackId, instanceId) => {
        const runtime = runtimes.find(candidate => candidate.instanceId === instanceId);
        const source = graph.postFaderOutputs.get(sourceTrackId);
        if (runtime?.sidechainInputNode && source) {
          try {
            source.disconnect(runtime.sidechainInputNode);
          } catch {
            // 아래 노드 dispose가 연결 리소스를 최종 정리한다.
          }
        }
      });
    });
    graph.pluginSidechainSourceTrackIds.clear();
    const midiCleanupResult = graph.midiRuntime.dispose();
    const isMasterMeterDisposed = this.disposeMeterRuntimeSafely(graph.masterMeterRuntime, errorMessage);
    const isMonitorMonoDisposed = this.disposeMonitorMonoSafely(graph.monitorMono, errorMessage);
    const isOutputDisposed = this.disposeOutput(graph.output, errorMessage);

    graph.trackMeterRuntimes.forEach((runtime, trackId) => {
      if (this.disposeMeterRuntimeSafely(runtime, errorMessage)) {
        graph.trackMeterRuntimes.delete(trackId);
      }
    });

    graph.players.forEach((trackPlayers, trackId) => {
      trackPlayers.forEach((entry, regionId) => {
        const remainingPlayers = entry.players.filter(player => !this.disposePlayerSafely(player, errorMessage));
        entry.players = remainingPlayers;
        if (remainingPlayers.length === 0) {
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
        graph.pluginRuntimeStates.delete(trackId);
        return;
      }
      graph.pluginRuntimes.set(trackId, remainingRuntimes);
    });

    graph.trackInputs.forEach((input, trackId) => {
      if (this.disposeTrackInputSafely(input, errorMessage)) {
        graph.trackInputs.delete(trackId);
      }
    });

    graph.preFaderOutputs.forEach((output, trackId) => {
      if (this.disposeTrackInputSafely(output, errorMessage)) {
        graph.preFaderOutputs.delete(trackId);
      }
    });

    graph.postFaderOutputs.forEach((output, trackId) => {
      if (this.disposeTrackInputSafely(output, errorMessage)) {
        graph.postFaderOutputs.delete(trackId);
      }
    });

    graph.channels.forEach((channel, trackId) => {
      if (this.disposeChannelSafely(channel, errorMessage)) {
        graph.channels.delete(trackId);
        graph.desiredTrackVolumes.delete(trackId);
        graph.desiredTrackPans.delete(trackId);
        graph.automationLanes.delete(trackId);
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
      graph.preFaderOutputs.size +
      graph.postFaderOutputs.size +
      graph.trackMeterRuntimes.size +
      graph.channels.size +
      (isMasterMeterDisposed ? 0 : 1) +
      (isMonitorMonoDisposed ? 0 : 1) +
      (isOutputDisposed ? 0 : 1) +
      midiCleanupResult.failedResourceCount;
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
    this.automationRuntime.refresh();
    return previousGraph;
  }

  private notifyLiveInputStateChange(previousState: LiveInputRuntimeState): void {
    const currentState = this.getLiveInputState();
    if (
      currentState.deviceId === previousState.deviceId &&
      currentState.monitoringTrackId === previousState.monitoringTrackId
    ) {
      return;
    }

    this.liveInputStateListeners.forEach(listener => listener(currentState));
  }

  private getRecordingRuntime(method: string): ILinearRecordingAudioRuntime {
    if (this.recordingRuntime) {
      return this.recordingRuntime;
    }
    throw new UnsupportedAudioFeatureError({ feature: AudioRuntimeFeature.LINEAR_RECORDING, method });
  }

  private getRecordingInputRoute(trackId: string): SetTrackRecordingInputRequest {
    const route = this.recordingState.inputRoutes.find(inputRoute => inputRoute.trackId === trackId);
    if (route) {
      return { ...route };
    }
    throw new Error(`arm된 Track의 입력 Route를 찾을 수 없습니다: ${trackId}`);
  }

  private updateRecordingState(nextState: RecordingRuntimeState): void {
    const previousState = this.recordingState;
    if (
      areStringArraysEqual(previousState.armedTrackIds, nextState.armedTrackIds) &&
      areRecordingInputRoutesEqual(previousState.inputRoutes, nextState.inputRoutes) &&
      previousState.phase === nextState.phase &&
      previousState.recordStartTimeSeconds === nextState.recordStartTimeSeconds
    ) {
      return;
    }
    this.recordingState = {
      ...nextState,
      armedTrackIds: [...nextState.armedTrackIds],
      inputRoutes: nextState.inputRoutes.map(route => ({ ...route })),
    };
    this.recordingStateListeners.forEach(listener => listener(this.getRecordingState()));
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

  private createGraphOutputNodes({
    initialGain,
    monitorState = DEFAULT_AUDIO_MONITOR_STATE,
    unmutedGain,
  }: CreateGraphOutputRequest): {
    readonly meterRuntime: IAudioMeterRuntime;
    readonly monitorMono: Tone.Mono;
    readonly output: Tone.Gain;
  } {
    const output = new Tone.Gain({ gain: initialGain });
    const monitorMono = new Tone.Mono();
    this.unmutedOutputGains.set(output, unmutedGain);
    this.monitorStates.set(output, cloneAudioMonitorState(monitorState));
    if (initialGain === 0) {
      this.mutedOutputs.add(output);
    }

    try {
      this.connectMonitorOutput(output, monitorMono, monitorState);
      const meterRuntime = this.meterRuntimeFactory.create(output);
      return { meterRuntime, monitorMono, output };
    } catch (cause) {
      this.disposeMonitorMonoSafely(monitorMono, '연결에 실패한 Monitor mono node 정리에 실패했습니다.');
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

    output.gain.value = muted ? 0 : this.getMonitorAdjustedGain(output, this.unmutedOutputGains.get(output) ?? 1);
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

  private getMonitorAdjustedGain(output: Tone.Gain, masterGain: number): number {
    const state = this.monitorStates.get(output) ?? DEFAULT_AUDIO_MONITOR_STATE;
    if (state.isCut) {
      return 0;
    }
    return state.isDimmed ? masterGain * AUDIO_MONITOR_DIM_GAIN : masterGain;
  }

  private replaceMonitorOutputConnection({
    nextState,
    previousState,
  }: {
    readonly nextState: AudioMonitorState;
    readonly previousState: AudioMonitorState;
  }): void {
    try {
      this.connectMonitorOutput(this.output, this.monitorMono, nextState);
      this.disconnectMonitorOutput(this.output, this.monitorMono, previousState);
    } catch (cause) {
      try {
        this.disconnectMonitorOutput(this.output, this.monitorMono, nextState);
        this.connectMonitorOutput(this.output, this.monitorMono, previousState);
      } catch (compensationCause) {
        throw new AudioEngineError(
          AudioEngineErrorCode.MONITOR_ROUTING_FAILED,
          ERROR_MESSAGES[AudioEngineErrorCode.MONITOR_ROUTING_FAILED],
          {
            cause: this.describeError(cause),
            compensationCause: this.describeError(compensationCause),
          }
        );
      }
      throw new AudioEngineError(
        AudioEngineErrorCode.MONITOR_ROUTING_FAILED,
        ERROR_MESSAGES[AudioEngineErrorCode.MONITOR_ROUTING_FAILED],
        { cause: this.describeError(cause) }
      );
    }
  }

  private connectMonitorOutput(output: Tone.Gain, monitorMono: Tone.Mono, state: AudioMonitorState): void {
    if (state.isMono) {
      monitorMono.toDestination();
      output.connect(monitorMono);
      return;
    }
    output.toDestination();
  }

  private disconnectMonitorOutput(output: Tone.Gain, monitorMono: Tone.Mono, state: AudioMonitorState): void {
    if (state.isMono) {
      output.disconnect(monitorMono);
      monitorMono.disconnect();
      return;
    }
    output.disconnect(Tone.getDestination());
  }

  private disposeMonitorMonoSafely(monitorMono: Tone.Mono, errorMessage: string): boolean {
    if (this.disposedMonitorMonoNodes.has(monitorMono)) {
      return true;
    }
    this.tryCleanupStep(() => monitorMono.disconnect(), errorMessage);
    const isDisposed = this.tryCleanupStep(() => monitorMono.dispose(), errorMessage);
    if (isDisposed) {
      this.disposedMonitorMonoNodes.add(monitorMono);
    }
    return isDisposed;
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

  private disposeMeterRuntimeSafely(runtime: IAudioMeterRuntime, errorMessage: string): boolean {
    this.pendingMeterRuntimeCleanup.add(runtime);
    if (!this.disposedMeterRuntimes.has(runtime)) {
      const isDisposed = this.tryCleanupStep(() => runtime.dispose(), errorMessage);
      if (isDisposed) {
        this.disposedMeterRuntimes.add(runtime);
      }
    }

    const isComplete = this.disposedMeterRuntimes.has(runtime);
    if (isComplete) {
      this.pendingMeterRuntimeCleanup.delete(runtime);
    }
    return isComplete;
  }

  private applyGraphAudibility(graph: AudioProjectGraphState): void {
    graph.channels.forEach((channel, trackId) => {
      const shouldMute = this.isTrackMutedInGraph(graph, trackId);
      channel.mute = shouldMute;
      if (!shouldMute) {
        channel.volume.value = Tone.gainToDb(this.getEffectiveTrackVolume(graph, trackId));
      }
    });
  }

  private isTrackMutedInGraph(graph: AudioProjectGraphState, trackId: string): boolean {
    const route = graph.routingRuntime.getSnapshot().routes.find(candidate => candidate.trackId === trackId);
    const assignedVcaIds = route?.vcaIds ?? [];
    if (graph.mutedTrackIds.has(trackId) || assignedVcaIds.some(vcaId => graph.mutedTrackIds.has(vcaId))) {
      return true;
    }

    if (graph.soloedTrackIds.size === 0) {
      return false;
    }

    return !graph.soloedTrackIds.has(trackId) && !assignedVcaIds.some(vcaId => graph.soloedTrackIds.has(vcaId));
  }

  private getEffectiveTrackVolume(graph: AudioProjectGraphState, trackId: string): number {
    const route = graph.routingRuntime.getSnapshot().routes.find(candidate => candidate.trackId === trackId);
    const vcaGain = (route?.vcaIds ?? []).reduce(
      (gain, vcaId) => gain * (graph.desiredTrackVolumes.get(vcaId) ?? 1),
      1
    );
    return (graph.desiredTrackVolumes.get(trackId) ?? 1) * vcaGain;
  }

  private getVolumeAffectedTrackIds(graph: AudioProjectGraphState, trackId: string): string[] {
    const routingGraph = graph.routingRuntime.getSnapshot();
    const route = routingGraph.routes.find(candidate => candidate.trackId === trackId);
    if (route?.kind !== 'vca') {
      return [trackId];
    }
    return routingGraph.routes
      .filter(candidate => candidate.vcaIds.includes(trackId))
      .map(candidate => candidate.trackId);
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
    [...this.pendingMeterRuntimeCleanup].forEach(runtime =>
      this.disposeMeterRuntimeSafely(runtime, '대기 중인 Meter runtime 정리에 실패했습니다.')
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

  private assertAutomationTargetsResolvable(graph: AudioProjectGraphState): void {
    graph.automationLanes.forEach((automationLanes, trackId) => {
      automationLanes
        .filter(lane => lane.isEnabled && lane.points.length > 0)
        .forEach(lane => {
          const target = lane.target;
          if (
            target.kind === 'pluginParameter' &&
            graph.pluginRuntimeStates
              .get(trackId)
              ?.some(
                state =>
                  state.instanceId === target.pluginInstanceId &&
                  (state.status === 'failed' || state.status === 'missing')
              )
          ) {
            return;
          }
          this.resolveAutomationTarget(graph, { target, trackId });
        });
    });
  }

  private assertAutomationRoutingTargetsResolvable(
    activeGraph: AudioProjectGraphState,
    routingGraph: RoutingGraphSnapshot
  ): void {
    const sendsById = new Map(routingGraph.sends.map(send => [send.id, send]));
    activeGraph.automationLanes.forEach((automationLanes, trackId) => {
      automationLanes
        .filter(lane => lane.isEnabled && lane.points.length > 0 && lane.target.kind === 'sendGain')
        .forEach(lane => {
          if (lane.target.kind !== 'sendGain') {
            return;
          }
          const send = sendsById.get(lane.target.sendId);
          if (send?.isEnabled && send.sourceTrackId === trackId) {
            return;
          }
          throw this.createAutomationTargetNotFoundError(trackId, lane.target);
        });
    });
  }

  private resolveAutomationTarget(
    graph: AudioProjectGraphState,
    { target, trackId }: { readonly target: AutomationTarget; readonly trackId: string }
  ): IAutomationAudioTarget {
    const channel = graph.channels.get(trackId);
    if (!channel) {
      throw this.createAutomationTargetNotFoundError(trackId, target);
    }
    if (target.kind === 'trackVolume') {
      return createMappedAutomationTarget({
        baseValue: () => Tone.gainToDb(graph.desiredTrackVolumes.get(trackId) ?? 1),
        mapValue: value => Tone.gainToDb(value),
        parameter: channel.volume,
      });
    }
    if (target.kind === 'trackPan') {
      return createMappedAutomationTarget({
        baseValue: () => graph.desiredTrackPans.get(trackId) ?? 0,
        mapValue: value => value * 2 - 1,
        parameter: channel.pan,
      });
    }
    if (target.kind === 'sendGain') {
      const sendTarget = graph.routingRuntime.getSendAutomationTarget(target.sendId);
      if (sendTarget) {
        return sendTarget;
      }
      throw this.createAutomationTargetNotFoundError(trackId, target);
    }

    const pluginTarget = graph.pluginRuntimes
      .get(trackId)
      ?.find(runtime => runtime.instanceId === target.pluginInstanceId)
      ?.getAutomationTarget?.(target.parameterId);
    if (pluginTarget) {
      return pluginTarget;
    }
    throw this.createAutomationTargetNotFoundError(trackId, target);
  }

  private createAutomationTargetNotFoundError(trackId: string, target: AutomationTarget): AudioEngineError {
    return new AudioEngineError(
      AudioEngineErrorCode.AUTOMATION_TARGET_NOT_FOUND,
      ERROR_MESSAGES[AudioEngineErrorCode.AUTOMATION_TARGET_NOT_FOUND],
      { target, trackId }
    );
  }

  private getExistingInput(trackId: string): Tone.Gain {
    const input = this.trackInputs.get(trackId);
    if (!input) {
      throw new AudioEngineError(AudioEngineErrorCode.TRACK_NOT_FOUND, ERROR_MESSAGES.TRACK_NOT_FOUND, { trackId });
    }
    return input;
  }

  private getExistingPreFaderOutput(trackId: string): Tone.Gain {
    const output = this.preFaderOutputs.get(trackId);
    if (!output) {
      throw new AudioEngineError(AudioEngineErrorCode.TRACK_NOT_FOUND, ERROR_MESSAGES.TRACK_NOT_FOUND, { trackId });
    }
    return output;
  }

  private createRoutingTrackNodes(graph: AudioProjectGraphState): Map<string, AudioRoutingTrackNodes> {
    const nodes = new Map<string, AudioRoutingTrackNodes>();
    graph.trackInputs.forEach((input, trackId) => {
      const preFaderOutput = graph.preFaderOutputs.get(trackId);
      const postFaderOutput = graph.postFaderOutputs.get(trackId);
      if (preFaderOutput && postFaderOutput) {
        nodes.set(trackId, { input, postFaderOutput, preFaderOutput });
      }
    });
    return nodes;
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
    const schedulingRegions = request.schedulingRegions ?? request.regions;

    try {
      request.regions.forEach(regionData => {
        const playbackSegments = createAudibleRegionSegments({ region: regionData, regions: schedulingRegions });
        const primarySegment = playbackSegments[0] ?? regionData;
        const entry = {
          players: [new Tone.Player(this.createPlayerOptions(primarySegment))],
          playbackSegments,
          regionData: this.cloneRegionData(regionData),
          revision: 0,
        };
        entries.push(entry);
        entry.players[0]?.connect(request.input);
      });
    } catch (cause) {
      this.cleanupRegionEntries(entries);
      throw new AudioEngineError(AudioEngineErrorCode.TRACK_INIT_FAILED, ERROR_MESSAGES.TRACK_INIT_FAILED, {
        cause: this.describeError(cause),
      });
    }

    const loadResults = await Promise.allSettled(entries.map(entry => entry.players[0]?.load(entry.regionData.url)));
    const loadFailure = loadResults.find(result => result.status === 'rejected');
    if (loadFailure?.status === 'rejected') {
      this.cleanupRegionEntries(entries);
      throw new AudioEngineError(AudioEngineErrorCode.REGION_LOAD_FAILED, ERROR_MESSAGES.REGION_LOAD_FAILED, {
        cause: this.describeError(loadFailure.reason),
      });
    }

    try {
      entries.forEach(entry => {
        this.appendAdditionalSegmentPlayers(entry, request.input);
        this.scheduleEntryPlayers(entry);
      });
    } catch (error) {
      this.cleanupRegionEntries(entries);
      throw new AudioEngineError(AudioEngineErrorCode.REGION_SCHEDULE_FAILED, ERROR_MESSAGES.REGION_SCHEDULE_FAILED, {
        cause: this.describeError(error),
      });
    }

    return entries;
  }

  private createRescheduledTrackRegionEntries({
    input,
    loadedEntries = [],
    regions,
    trackPlayers,
    updatedEntries = new Map(),
  }: {
    readonly input: Tone.Gain;
    readonly loadedEntries?: readonly RegionPlayerEntry[];
    readonly regions: readonly RegionData[];
    readonly trackPlayers: ReadonlyMap<string, RegionPlayerEntry>;
    readonly updatedEntries?: ReadonlyMap<string, RegionPlayerEntry>;
  }): RegionPlayerEntry[] {
    const sourceEntries = new Map(trackPlayers);
    updatedEntries.forEach((entry, regionId) => sourceEntries.set(regionId, entry));
    loadedEntries.forEach(entry => sourceEntries.set(entry.regionData.id, entry));
    const nextEntries: RegionPlayerEntry[] = [];

    try {
      regions.forEach(regionData => {
        const sourceEntry = sourceEntries.get(regionData.id);
        const nextEntry = this.createRegionEntryFromBuffer({
          buffer: sourceEntry?.players[0]?.buffer,
          input,
          regionData,
          regions,
          revision: (sourceEntry?.revision ?? 0) + 1,
        });
        nextEntries.push(nextEntry);
        this.scheduleEntryPlayers(nextEntry);
      });
    } catch (error) {
      this.cleanupRegionEntries(nextEntries);
      if (error instanceof AudioEngineError) {
        throw error;
      }
      throw new AudioEngineError(AudioEngineErrorCode.REGION_SCHEDULE_FAILED, ERROR_MESSAGES.REGION_SCHEDULE_FAILED, {
        cause: this.describeError(error),
      });
    }

    return nextEntries;
  }

  private replaceActiveTrackRegionEntries(
    trackPlayers: Map<string, RegionPlayerEntry>,
    nextEntries: readonly RegionPlayerEntry[]
  ): void {
    const previousEntries = [...trackPlayers.values()];
    trackPlayers.clear();
    nextEntries.forEach(entry => trackPlayers.set(entry.regionData.id, entry));
    this.cleanupRegionEntries(previousEntries);
  }

  private createRegionEntryFromBuffer({
    buffer,
    input,
    regionData,
    regions,
    revision,
  }: {
    readonly buffer: Tone.ToneAudioBuffer | undefined;
    readonly input: Tone.Gain;
    readonly regionData: RegionData;
    readonly regions: readonly RegionData[];
    readonly revision: number;
  }): RegionPlayerEntry {
    if (!buffer) {
      throw new AudioEngineError(AudioEngineErrorCode.REGION_STATE_CHANGED, ERROR_MESSAGES.REGION_STATE_CHANGED, {
        regionId: regionData.id,
      });
    }

    const playbackSegments = createAudibleRegionSegments({ region: regionData, regions });
    const segmentsForPlayers = playbackSegments.length === 0 ? [regionData] : playbackSegments;
    const players = segmentsForPlayers.map(segment =>
      new Tone.Player({ ...this.createPlayerOptions(segment), url: buffer }).connect(input)
    );
    return {
      playbackSegments,
      players,
      regionData: this.cloneRegionData(regionData),
      revision,
    };
  }

  private appendAdditionalSegmentPlayers(entry: RegionPlayerEntry, input: Tone.Gain): void {
    const buffer = entry.players[0]?.buffer;
    if (!buffer) {
      return;
    }

    entry.playbackSegments.slice(1).forEach(segment => {
      entry.players.push(new Tone.Player({ ...this.createPlayerOptions(segment), url: buffer }).connect(input));
    });
  }

  private createPlayerOptions(regionData: RegionData): Partial<Tone.PlayerOptions> {
    return {
      fadeIn: regionData.fadeIn.durationSeconds,
      fadeOut: regionData.fadeOut.durationSeconds,
      loop: false,
      volume: Tone.gainToDb(regionData.gain),
    };
  }

  private scheduleEntryPlayers(entry: RegionPlayerEntry): void {
    entry.playbackSegments.forEach((segment, index) => {
      const player = entry.players[index];
      if (player) {
        this.schedulePlayer(player, segment);
      }
    });
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
    return {
      ...regionData,
      fadeIn: { ...regionData.fadeIn },
      fadeOut: { ...regionData.fadeOut },
    };
  }

  private cleanupRegionEntries(entries: RegionPlayerEntry[]): void {
    entries.forEach(entry => {
      entry.players.forEach(player => this.disposePlayerSafely(player, 'Region Player 정리에 실패했습니다.'));
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
    const output = new Tone.Gain({ gain: request.masterVolume }).toDestination();
    const trackRuntimes = new Map<string, OfflineExportTrackRuntime>();
    const audibleTrackIds = new Set(this.getAudibleTracks(request.tracks).map(track => track.id));

    request.tracks.forEach(track => {
      const channel = new Tone.Channel({
        volume: Tone.gainToDb(track.volume),
        pan: track.pan,
      });
      const input = new Tone.Gain({ gain: 1 });
      const preFaderOutput = new Tone.Gain({ gain: 1 });
      const postFaderOutput = new Tone.Gain({ gain: 1 });
      const preparedPlugins = this.createPreparedPluginRuntimes({
        trackId: track.id,
        pluginInstances: track.pluginInstances,
      });
      const pluginRuntimes = preparedPlugins.runtimes;
      const disabledPluginInstanceIds = new Set(
        track.pluginInstances.filter(instance => !instance.isEnabled).map(instance => instance.instanceId)
      );
      this.connectPreparedPluginChain({
        input,
        destination: preFaderOutput,
        runtimes: getEnabledPluginRuntimes(pluginRuntimes, disabledPluginInstanceIds),
        trackId: track.id,
      });
      preFaderOutput.connect(channel);
      channel.connect(postFaderOutput);
      trackRuntimes.set(track.id, { channel, input, pluginRuntimes, postFaderOutput, preFaderOutput, track });
    });

    const routingRuntime = new AudioRoutingRuntime();
    const routingGraph =
      request.routingGraph ?? createDefaultRoutingGraphSnapshot(request.tracks.map(track => track.id));
    routingRuntime.apply(
      routingGraph,
      new Map(
        [...trackRuntimes].map(([trackId, runtime]) => [
          trackId,
          {
            input: runtime.input,
            postFaderOutput: runtime.postFaderOutput,
            preFaderOutput: runtime.preFaderOutput,
          },
        ])
      ),
      output
    );

    trackRuntimes.forEach(({ channel, input, pluginRuntimes, track }) => {
      if (!audibleTrackIds.has(track.id)) {
        channel.volume.value = Number.NEGATIVE_INFINITY;
        return;
      }

      (track.automationLanes ?? [])
        .filter(lane => lane.isEnabled && lane.points.length > 0)
        .forEach(lane => {
          const target = this.resolveExportAutomationTarget({
            channel,
            pluginRuntimes,
            routingRuntime,
            target: lane.target,
            track,
          });
          scheduleAutomationLane({
            audioStartTimeSeconds: 0,
            lane,
            target,
            timelineEndTimeSeconds: request.range.endTime,
            timelineStartTimeSeconds: request.range.startTime,
          });
        });

      for (const region of track.regions) {
        const segments = createAudibleRegionSegments({ region, regions: track.regions });
        segments.forEach(segment => {
          const params = RegionRenderer.adjustForExportRange(
            RegionRenderer.calculateRenderParams(segment),
            request.range
          );
          if (params.duration <= 0) {
            return;
          }

          scheduledPlayers.push({
            player: new Tone.Player({
              fadeIn: params.fadeIn.durationSeconds,
              fadeOut: params.fadeOut.durationSeconds,
              loop: false,
              volume: Tone.gainToDb(params.gain),
            }).connect(input),
            params,
          });
        });
      }
    });

    await Promise.all(scheduledPlayers.map(({ player, params }) => player.load(params.url)));
    scheduledPlayers.forEach(({ player, params }) => {
      startPlayer({ player, syncMode: false, ...params });
    });
  }

  private resolveExportAutomationTarget({
    channel,
    pluginRuntimes,
    routingRuntime,
    target,
    track,
  }: {
    readonly channel: Tone.Channel;
    readonly pluginRuntimes: readonly IAudioPluginRuntime[];
    readonly routingRuntime: AudioRoutingRuntime;
    readonly target: AutomationTarget;
    readonly track: ExportTrack;
  }): IAutomationAudioTarget {
    if (target.kind === 'trackVolume') {
      return createMappedAutomationTarget({
        baseValue: () => Tone.gainToDb(track.volume),
        mapValue: value => Tone.gainToDb(value),
        parameter: channel.volume,
      });
    }
    if (target.kind === 'trackPan') {
      return createMappedAutomationTarget({
        baseValue: () => track.pan,
        mapValue: value => value * 2 - 1,
        parameter: channel.pan,
      });
    }
    if (target.kind === 'pluginParameter') {
      const pluginTarget = pluginRuntimes
        .find(runtime => runtime.instanceId === target.pluginInstanceId)
        ?.getAutomationTarget?.(target.parameterId);
      if (pluginTarget) {
        return pluginTarget;
      }
    }
    if (target.kind === 'sendGain') {
      const sendTarget = routingRuntime.getSendAutomationTarget(target.sendId);
      if (sendTarget) {
        return sendTarget;
      }
    }
    throw this.createAutomationTargetNotFoundError(track.id, target);
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

function areStringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function areRecordingInputRoutesEqual(
  left: readonly SetTrackRecordingInputRequest[],
  right: readonly SetTrackRecordingInputRequest[]
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (route, index) =>
        route.trackId === right[index]?.trackId &&
        route.deviceId === right[index]?.deviceId &&
        route.channelIndex === right[index]?.channelIndex
    )
  );
}

interface CreateDerivedPcmChannelsRequest {
  readonly request: RenderDerivedAudioRegionRequest;
  readonly sampleRate: number;
  readonly sourceChannels: readonly Float32Array[];
}

function createDerivedPcmChannels({
  request,
  sampleRate,
  sourceChannels,
}: CreateDerivedPcmChannelsRequest): Float32Array[] {
  switch (request.operation) {
    case 'reverse':
      return reversePcmChannels(sourceChannels);
    case 'stripSilence':
      return stripSilenceFromPcmChannels({
        channels: sourceChannels,
        minimumSilenceFrames: Math.max(1, Math.round((request.minimumSilenceSeconds ?? 0.1) * sampleRate)),
        thresholdLinear: Math.pow(10, (request.thresholdDb ?? -60) / 20),
      });
    case 'timeStretch':
      return timeStretchPcmChannels({ channels: sourceChannels, stretchRatio: request.stretchRatio ?? 1 });
    case 'pitchShift':
      return pitchShiftPcmChannels({ channels: sourceChannels, semitones: request.pitchSemitones ?? 0 });
    case 'bounce':
    case 'freeze':
    case 'transientAnalysis':
      return sourceChannels.map(channel => Float32Array.from(channel));
  }
}
