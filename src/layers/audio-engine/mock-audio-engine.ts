import { AudioEngineError, AudioEngineErrorCode, ERROR_MESSAGES } from './errors';
import { COMPLETE_RESOURCE_CLEANUP } from '../shared/types/resource-cleanup';
import {
  cloneAudioMonitorState,
  DEFAULT_AUDIO_MONITOR_STATE,
  type AudioMonitorState,
  type AudioMonitorStateListener,
} from '../shared/types/audio-monitor-state';
import { insertArrayEntry, moveArrayEntry } from '../shared/array-order';
import type { TimelineRange } from '../shared/types/project-document.schema';
import {
  assertValidRoutingGraphSnapshot,
  cloneRoutingGraphSnapshot,
  createDefaultRoutingGraphSnapshot,
  removeTrackFromRoutingGraph,
  type RoutingGraphSnapshot,
} from '../shared/types/routing-state';
import type {
  ExportRequest,
  ArmLoopRequest,
  ConfigureLoopRequest,
  AuditionAudioSourceRequest,
  IAudioEngine,
  InstallAudioPluginRequest,
  LoadLoopRequest,
  LiveAudioInputDevice,
  LiveInputRuntimeListener,
  LiveInputRuntimeState,
  LoopRuntimeEvent,
  LoopRuntimeListener,
  LoopRuntimeState,
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
import type { PluginParameterValue, PluginRuntimeState } from '../shared/types/plugin-state';
import {
  CURRENT_AUDIO_RUNTIME_FEATURE_SUPPORT,
  type AudioRuntimeFeatureSupport,
} from '../shared/utils/audio-runtime-capabilities';
import { BUILTIN_MIDI_INSTRUMENT_ID, cloneMidiTrackState, type MidiTrackState } from '../shared/types/midi-state';
import {
  createIdleRenderJobState,
  type RenderJobResult,
  type RenderJobState,
  type RenderJobStateListener,
} from '../shared/types/render-job';
import type { AudioEngineRuntimeHealth } from '../shared/types/runtime-diagnostics';

interface MockTrackState {
  muted: boolean;
  pan: number;
  soloed: boolean;
  volume: number;
}

interface MockPluginState {
  readonly manifestId: string;
  isEnabled: boolean;
  readonly parameters: Map<string, PluginParameterValue>;
  sidechainSourceTrackId: string | null;
}

export class MockAudioEngine implements IAudioEngine {
  private mockTime = 0;
  private mockMasterVolume = 1;
  private mockMonitorState: AudioMonitorState = DEFAULT_AUDIO_MONITOR_STATE;
  private mockRoutingGraph: RoutingGraphSnapshot = { routes: [], sends: [] };
  private mockTracks: Map<string, MockTrackState> = new Map();
  private mockRegions: Map<string, Map<string, RegionData>> = new Map();
  private mockPlugins: Map<string, Map<string, MockPluginState>> = new Map();
  private graphRevision = 0;
  private mockInputDeviceId: string | null = null;
  private mockLoopStates = new Map<string, LoopRuntimeState>();
  private readonly loopListeners = new Set<LoopRuntimeListener>();
  private mockTempoChanges: SetAudioTempoMapRequest['changes'] = [{ bpm: 120, quarterNotePosition: 0 }];
  private mockLoopRange: TimelineRange | null = null;
  private mockLoopEnabled = false;
  private mockMetronomeEnabled = false;
  private mockMetronomeVolume = 0.8;
  private mockMeterFrames = new Map<string, MeterFrame>();
  private mockLiveInputDevices: LiveAudioInputDevice[] = [];
  private mockMonitoringTrackId: string | null = null;
  private mockRecordingState: RecordingRuntimeState = {
    armedTrackIds: [],
    inputRoutes: [],
    phase: 'idle',
    recordStartTimeSeconds: null,
  };
  private readonly recordingStateListeners = new Set<RecordingRuntimeListener>();
  private readonly monitorStateListeners = new Set<AudioMonitorStateListener>();
  private readonly liveInputStateListeners = new Set<LiveInputRuntimeListener>();
  private mockAudioRegionPeak = 0.5;
  private mockAuditionBlob: Blob | null = null;
  private mockAutomationLanes = new Map<string, SetAutomationLanesRequest['automationLanes']>();
  private mockMidiTracks = new Map<string, MidiTrackState>();
  private mockRenderJobState: RenderJobState = createIdleRenderJobState();
  private readonly renderJobStateListeners = new Set<RenderJobStateListener>();
  private mockRuntimeHealth: AudioEngineRuntimeHealth = {
    audioContextState: 'running',
    pendingCleanupResourceCount: 0,
  };

  listAvailablePluginManifestIds(): readonly string[] {
    return ['builtin.gain', 'builtin.saturation'];
  }

  readPluginRuntimeStates(trackId: string): readonly PluginRuntimeState[] {
    return [...(this.mockPlugins.get(trackId) ?? new Map())].map(([instanceId, plugin]) => ({
      instanceId,
      latencySamples: 0,
      reason: null,
      status: plugin.isEnabled ? 'active' : 'bypassed',
    }));
  }

  getFeatureSupport(): AudioRuntimeFeatureSupport {
    return { ...CURRENT_AUDIO_RUNTIME_FEATURE_SUPPORT, metering: true, midi: true, tempoLoopMetronome: true };
  }

  getRuntimeHealth(): AudioEngineRuntimeHealth {
    return { ...this.mockRuntimeHealth };
  }

  async resumeRuntime(): Promise<AudioEngineRuntimeHealth> {
    this.mockRuntimeHealth = { ...this.mockRuntimeHealth, audioContextState: 'running' };
    return this.getRuntimeHealth();
  }

  setMockRuntimeHealth(health: AudioEngineRuntimeHealth): void {
    this.mockRuntimeHealth = { ...health };
  }

  async addMidiTrack(trackId: string): Promise<void> {
    await this.addTrack(trackId);
    this.mockMidiTracks.set(trackId, {
      instrumentId: BUILTIN_MIDI_INSTRUMENT_ID,
      recordMode: 'replace',
      regions: [],
    });
  }

  setMidiTrackState(request: SetMidiTrackStateRequest): void {
    this.getTrack(request.trackId);
    if (!this.mockMidiTracks.has(request.trackId)) {
      throw new AudioEngineError(AudioEngineErrorCode.TRACK_NOT_FOUND, ERROR_MESSAGES.TRACK_NOT_FOUND, {
        reason: 'TRACK_NOT_MIDI',
        trackId: request.trackId,
      });
    }
    this.mockMidiTracks.set(request.trackId, cloneMidiTrackState(request.midi));
    this.graphRevision += 1;
  }

  sendMidiInputEvent(request: SendMidiInputEventRequest): void {
    this.getTrack(request.trackId);
  }

  midiPanic(): void {}

  getMockMidiTrackState(trackId: string): MidiTrackState | null {
    const midi = this.mockMidiTracks.get(trackId);
    return midi ? cloneMidiTrackState(midi) : null;
  }

  setAutomationLanes(request: SetAutomationLanesRequest): void {
    if (!this.mockTracks.has(request.trackId)) {
      throw new AudioEngineError(AudioEngineErrorCode.TRACK_NOT_FOUND, ERROR_MESSAGES.TRACK_NOT_FOUND, {
        trackId: request.trackId,
      });
    }
    this.mockAutomationLanes.set(
      request.trackId,
      request.automationLanes.map(lane => ({
        ...lane,
        points: lane.points.map(point => ({ ...point })),
        target: { ...lane.target },
      }))
    );
  }

  setMockAudioRegionPeak(peak: number): void {
    this.mockAudioRegionPeak = peak;
  }

  async analyzeAudioRegionPeak(_request: AnalyzeAudioRegionPeakRequest): Promise<number> {
    void _request;
    return this.mockAudioRegionPeak;
  }

  async renderDerivedAudioRegion(request: RenderDerivedAudioRegionRequest): Promise<RenderedDerivedAudioRegion> {
    return { blob: request.blob, durationSeconds: request.durationSeconds };
  }

  async auditionAudioSource({ blob }: AuditionAudioSourceRequest): Promise<void> {
    this.mockAuditionBlob = blob;
  }

  stopAudioSourceAudition(): void {
    this.mockAuditionBlob = null;
  }

  getMockAuditionBlob(): Blob | null {
    return this.mockAuditionBlob;
  }

  async play(): Promise<void> {
    console.log('[MockAudioEngine] Playing...');
  }

  pause(): void {
    console.log('[MockAudioEngine] Paused.');
  }

  stop(): void {
    console.log('[MockAudioEngine] Stopped.');
    this.mockTime = 0;
  }

  setTime(time: number): void {
    this.mockTime = time;
    console.log(`[MockAudioEngine] Time set to: ${time}`);
  }

  getCurrentTime(): number {
    return this.mockTime;
  }

  setTempoMap(request: SetAudioTempoMapRequest): void {
    this.mockTempoChanges = request.changes.map(change => ({ ...change }));
  }

  setLoopRange(range: TimelineRange | null): void {
    this.mockLoopRange = range ? { ...range } : null;
    if (range === null) {
      this.mockLoopEnabled = false;
    }
  }

  setLoopEnabled(isEnabled: boolean): void {
    if (isEnabled && this.mockLoopRange === null) {
      throw new RangeError('Loop를 활성화하려면 범위를 먼저 설정해야 합니다.');
    }
    this.mockLoopEnabled = isEnabled;
  }

  setMetronomeEnabled(isEnabled: boolean): void {
    this.mockMetronomeEnabled = isEnabled;
  }

  setMetronomeVolume(volume: number): void {
    this.mockMetronomeVolume = volume;
  }

  getMockTransportState() {
    return {
      isLoopEnabled: this.mockLoopEnabled,
      isMetronomeEnabled: this.mockMetronomeEnabled,
      loopRange: this.mockLoopRange ? { ...this.mockLoopRange } : null,
      metronomeVolume: this.mockMetronomeVolume,
      tempoChanges: this.mockTempoChanges.map(change => ({ ...change })),
    };
  }

  readMeterFrame(target: MeterTarget): MeterFrame {
    return cloneMeterFrame(
      this.mockMeterFrames.get(createMeterTargetKey(target)) ?? {
        capturedAtSeconds: this.mockTime,
        channels: [createSilentMeterChannel(), createSilentMeterChannel()],
      }
    );
  }

  setMockMeterFrame(target: MeterTarget, frame: MeterFrame): void {
    this.mockMeterFrames.set(createMeterTargetKey(target), cloneMeterFrame(frame));
  }

  async setLiveInputDevice(deviceId: string | null): Promise<string | null> {
    const previousState = this.getLiveInputState();
    this.mockInputDeviceId = deviceId;
    this.notifyLiveInputStateChange(previousState);
    return this.mockInputDeviceId;
  }

  getLiveInputState(): LiveInputRuntimeState {
    return { deviceId: this.mockInputDeviceId, monitoringTrackId: this.mockMonitoringTrackId };
  }

  async listLiveInputDevices(): Promise<readonly LiveAudioInputDevice[]> {
    return this.mockLiveInputDevices.map(device => ({ ...device }));
  }

  subscribeLiveInputState(listener: LiveInputRuntimeListener): () => void {
    this.liveInputStateListeners.add(listener);
    return () => this.liveInputStateListeners.delete(listener);
  }

  setMockLiveInputDevices(devices: readonly LiveAudioInputDevice[]): void {
    this.mockLiveInputDevices = devices.map(device => ({ ...device }));
  }

  async setLiveInputMonitoring(request: SetLiveInputMonitoringRequest): Promise<void> {
    if (request.enabled) {
      this.getTrack(request.trackId);
    }
    const previousState = this.getLiveInputState();
    this.mockMonitoringTrackId = request.enabled ? request.trackId : null;
    this.notifyLiveInputStateChange(previousState);
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

  async armLoop(request: ArmLoopRequest): Promise<void> {
    this.getTrack(request.trackId);
    this.setMockLoopState(request, 'armed');
  }

  async armLoopOverdub(request: ArmLoopRequest): Promise<void> {
    this.getTrack(request.trackId);
    this.setMockLoopState(request, 'armed');
  }

  cancelLoop(address: LoopSlotAddress): void {
    this.setMockLoopState(address, 'empty');
  }

  async triggerLoop(request: TriggerLoopRequest): Promise<void> {
    this.setMockLoopState(request, 'playing');
  }

  stopLoop(request: TriggerLoopRequest): void {
    this.setMockLoopState(request, 'stopped');
  }

  clearLoop(address: LoopSlotAddress): void {
    this.mockLoopStates.delete(this.createLoopKey(address));
    this.emitLoopEvent({ ...address, state: 'empty', type: 'STATE_CHANGED' });
  }

  configureLoop(request: ConfigureLoopRequest): void {
    this.getTrack(request.trackId);
  }

  stopAllLoops(_request: StopAllLoopsRequest): void {
    void _request;
    [...this.mockLoopStates.keys()].forEach(key => {
      const [trackId, slotId] = key.split('\u0000');
      this.setMockLoopState({ slotId, trackId }, 'stopped');
    });
  }

  async loadLoop(request: LoadLoopRequest): Promise<void> {
    this.getTrack(request.trackId);
    this.setMockLoopState(request, 'stopped');
  }

  subscribeLoopEvents(listener: LoopRuntimeListener): () => void {
    this.loopListeners.add(listener);
    return () => this.loopListeners.delete(listener);
  }

  getRecordingState(): RecordingRuntimeState {
    return {
      ...this.mockRecordingState,
      armedTrackIds: [...this.mockRecordingState.armedTrackIds],
      inputRoutes: this.mockRecordingState.inputRoutes.map(route => ({ ...route })),
    };
  }

  subscribeRecordingState(listener: RecordingRuntimeListener): () => void {
    this.recordingStateListeners.add(listener);
    return () => this.recordingStateListeners.delete(listener);
  }

  setTrackRecordArm(request: SetTrackRecordArmRequest): void {
    if (request.armed) {
      this.getTrack(request.trackId);
    }
    const armedTrackIds = request.armed
      ? [...new Set([...this.mockRecordingState.armedTrackIds, request.trackId])]
      : this.mockRecordingState.armedTrackIds.filter(trackId => trackId !== request.trackId);
    const hasInputRoute = this.mockRecordingState.inputRoutes.some(route => route.trackId === request.trackId);
    this.setMockRecordingState({
      armedTrackIds,
      inputRoutes:
        request.armed && !hasInputRoute
          ? [...this.mockRecordingState.inputRoutes, { channelIndex: 0, deviceId: null, trackId: request.trackId }]
          : this.mockRecordingState.inputRoutes,
    });
  }

  setTrackRecordingInput(request: SetTrackRecordingInputRequest): void {
    this.getTrack(request.trackId);
    this.setMockRecordingState({
      inputRoutes: [
        ...this.mockRecordingState.inputRoutes.filter(route => route.trackId !== request.trackId),
        { ...request },
      ],
    });
  }

  async startRecording(request: StartLinearRecordingRequest): Promise<void> {
    this.mockRecordingState.armedTrackIds.forEach(trackId => this.getTrack(trackId));
    if (this.mockRecordingState.armedTrackIds.length === 0) {
      throw new Error('녹음할 Track이 arm 상태가 아닙니다.');
    }
    this.setMockRecordingState({
      phase: request.startDelaySeconds > 0 ? 'scheduled' : 'recording',
      recordStartTimeSeconds: request.recordStartTimeSeconds,
    });
  }

  async stopRecording(): Promise<MultiTrackRecordingResult> {
    const state = this.mockRecordingState;
    if (state.armedTrackIds.length === 0 || state.recordStartTimeSeconds === null || state.phase === 'idle') {
      throw new Error('진행 중인 선형 녹음이 없습니다.');
    }
    this.setMockRecordingState({ phase: 'idle', recordStartTimeSeconds: null });
    return {
      failures: [],
      takes: state.armedTrackIds.map(trackId => ({
        blob: new Blob([], { type: 'audio/wav' }),
        durationSeconds: 0,
        sampleRate: 48_000,
        startedAtSeconds: state.recordStartTimeSeconds ?? 0,
        trackId,
      })),
    };
  }

  cancelRecording(): void {
    this.setMockRecordingState({ phase: 'idle', recordStartTimeSeconds: null });
  }

  private setMockRecordingState(updates: Partial<RecordingRuntimeState>): void {
    this.mockRecordingState = { ...this.mockRecordingState, ...updates };
    this.recordingStateListeners.forEach(listener => listener(this.getRecordingState()));
  }

  emitLoopEvent(event: LoopRuntimeEvent): void {
    this.loopListeners.forEach(listener => listener(event));
  }

  getMasterVolume(): number {
    return this.mockMasterVolume;
  }

  setMasterVolume(volume: number): void {
    this.mockMasterVolume = volume;
    this.graphRevision += 1;
  }

  getMonitorState(): AudioMonitorState {
    return cloneAudioMonitorState(this.mockMonitorState);
  }

  subscribeMonitorState(listener: AudioMonitorStateListener): () => void {
    this.monitorStateListeners.add(listener);
    return () => this.monitorStateListeners.delete(listener);
  }

  setMonitorState(state: AudioMonitorState): void {
    this.mockMonitorState = cloneAudioMonitorState(state);
    this.graphRevision += 1;
    this.monitorStateListeners.forEach(listener => listener(this.getMonitorState()));
  }

  getRoutingGraph(): RoutingGraphSnapshot {
    return cloneRoutingGraphSnapshot(this.mockRoutingGraph);
  }

  setRoutingGraph(graph: RoutingGraphSnapshot): void {
    assertValidRoutingGraphSnapshot(graph, [...this.mockTracks.keys()]);
    this.mockRoutingGraph = cloneRoutingGraphSnapshot(graph);
    this.graphRevision += 1;
  }

  async addTrack(trackId: string): Promise<void> {
    this.initializeTrack(trackId);
    this.mockRoutingGraph = {
      ...this.mockRoutingGraph,
      routes: [
        ...this.mockRoutingGraph.routes.filter(route => route.trackId !== trackId),
        ...createDefaultRoutingGraphSnapshot([trackId]).routes,
      ],
    };
    this.graphRevision += 1;
    console.log(`[MockAudioEngine] Track added: ${trackId}`);
  }

  removeTrack(trackId: string): void {
    this.mockTracks.delete(trackId);
    this.mockRegions.delete(trackId);
    this.mockPlugins.delete(trackId);
    this.mockMidiTracks.delete(trackId);
    this.mockRoutingGraph = removeTrackFromRoutingGraph(this.mockRoutingGraph, trackId);
    [...this.mockLoopStates.keys()]
      .filter(key => key.startsWith(`${trackId}\u0000`))
      .forEach(key => this.mockLoopStates.delete(key));
    this.graphRevision += 1;
    console.log(`[MockAudioEngine] Track ${trackId} removed`);
  }

  setTrackVolume(trackId: string, volume: number): void {
    this.initializeTrack(trackId);
    const track = this.mockTracks.get(trackId);
    if (track) {
      track.volume = volume;
    }
    this.graphRevision += 1;
    console.log(`[MockAudioEngine] Track ${trackId} volume set to: ${volume}`);
  }

  setTrackPan(trackId: string, pan: number): void {
    this.initializeTrack(trackId);
    const track = this.mockTracks.get(trackId);
    if (track) {
      track.pan = pan;
    }
    this.graphRevision += 1;
    console.log(`[MockAudioEngine] Track ${trackId} pan set to: ${pan}`);
  }

  setTrackMute(trackId: string, muted: boolean): void {
    this.getTrack(trackId).muted = muted;
    this.graphRevision += 1;
  }

  setTrackSolo(trackId: string, soloed: boolean): void {
    this.getTrack(trackId).soloed = soloed;
    this.graphRevision += 1;
  }

  getTrackParams(trackId: string): { volume: number; pan: number } | null {
    console.log(`[MockAudioEngine] Getting params for track: ${trackId}`);
    const track = this.mockTracks.get(trackId);
    if (!track) {
      return null;
    }
    return { volume: track.volume, pan: track.pan };
  }

  installPlugin(request: InstallAudioPluginRequest): void {
    const trackPlugins = this.getTrackPlugins(request.trackId);
    if (trackPlugins.has(request.instanceId)) {
      throw new AudioEngineError(
        AudioEngineErrorCode.PLUGIN_INSTANCE_ID_CONFLICT,
        ERROR_MESSAGES.PLUGIN_INSTANCE_ID_CONFLICT,
        { instanceId: request.instanceId, trackId: request.trackId }
      );
    }
    const targetIndex = request.targetIndex ?? trackPlugins.size;
    this.validatePluginTargetIndex({ ...request, targetIndex, maximumIndex: trackPlugins.size });
    const pluginEntry: [string, MockPluginState] = [
      request.instanceId,
      {
        manifestId: request.manifestId,
        isEnabled: request.isEnabled ?? true,
        parameters: new Map(request.parameterValues),
        sidechainSourceTrackId: request.sidechainSourceTrackId ?? null,
      },
    ];
    this.mockPlugins.set(
      request.trackId,
      new Map(insertArrayEntry({ entries: [...trackPlugins.entries()], entry: pluginEntry, targetIndex }))
    );
    this.graphRevision += 1;
  }

  removePlugin(trackId: string, instanceId: string): void {
    const trackPlugins = this.getTrackPlugins(trackId);
    if (!trackPlugins.delete(instanceId)) {
      throw this.createPluginInstanceNotFoundError(trackId, instanceId);
    }
    this.graphRevision += 1;
  }

  movePlugin(request: MoveAudioPluginRequest): void {
    const trackPlugins = this.getTrackPlugins(request.trackId);
    const pluginEntries = [...trackPlugins.entries()];
    const sourceIndex = pluginEntries.findIndex(([instanceId]) => instanceId === request.instanceId);
    if (sourceIndex < 0) {
      throw this.createPluginInstanceNotFoundError(request.trackId, request.instanceId);
    }
    this.validatePluginTargetIndex({ ...request, maximumIndex: pluginEntries.length - 1 });
    if (sourceIndex === request.targetIndex) {
      return;
    }
    const nextEntries = moveArrayEntry({ entries: pluginEntries, sourceIndex, targetIndex: request.targetIndex });
    this.mockPlugins.set(request.trackId, new Map(nextEntries));
    this.graphRevision += 1;
  }

  setPluginParameter(request: SetAudioPluginParameterRequest): void {
    const plugin = this.getTrackPlugins(request.trackId).get(request.instanceId);
    if (!plugin) {
      throw this.createPluginInstanceNotFoundError(request.trackId, request.instanceId);
    }
    plugin.parameters.set(request.parameterId, request.value);
    this.graphRevision += 1;
  }

  setPluginSidechain(request: SetAudioPluginSidechainRequest): void {
    const plugin = this.getTrackPlugins(request.trackId).get(request.instanceId);
    if (!plugin) {
      throw this.createPluginInstanceNotFoundError(request.trackId, request.instanceId);
    }
    if (request.sourceTrackId !== null) {
      this.getTrack(request.sourceTrackId);
    }
    plugin.sidechainSourceTrackId = request.sourceTrackId;
    this.graphRevision += 1;
  }

  setPluginEnabled(request: SetAudioPluginEnabledRequest): void {
    const plugin = this.getTrackPlugins(request.trackId).get(request.instanceId);
    if (!plugin) {
      throw this.createPluginInstanceNotFoundError(request.trackId, request.instanceId);
    }
    plugin.isEnabled = request.isEnabled;
    this.graphRevision += 1;
  }

  async addRegion(trackId: string, regionData: RegionData): Promise<void> {
    this.initializeTrack(trackId);
    const trackRegions = this.mockRegions.get(trackId);
    if (trackRegions?.has(regionData.id)) {
      throw new AudioEngineError(AudioEngineErrorCode.REGION_ID_CONFLICT, ERROR_MESSAGES.REGION_ID_CONFLICT, {
        trackId,
        regionId: regionData.id,
      });
    }
    trackRegions?.set(regionData.id, this.cloneRegionData(regionData));
    this.graphRevision += 1;
    console.log(`[MockAudioEngine] Adding region ${regionData.id} to track ${trackId}`);
  }

  removeRegion(trackId: string, regionId: string): void {
    this.mockRegions.get(trackId)?.delete(regionId);
    this.graphRevision += 1;
    console.log(`[MockAudioEngine] Removing region ${regionId} from track ${trackId}`);
  }

  rescheduleRegion(request: RescheduleRegionRequest): void {
    const trackRegions = this.mockRegions.get(request.trackId);
    const regionData = trackRegions?.get(request.regionId);
    if (!trackRegions || !regionData) {
      throw this.createRegionNotFoundError(request);
    }

    trackRegions.set(request.regionId, { ...regionData, startTime: request.startTime });
    this.graphRevision += 1;
  }

  async replaceRegion(request: ReplaceRegionRequest): Promise<void> {
    const currentRegions = this.mockRegions.get(request.trackId);
    if (!currentRegions?.has(request.regionId)) {
      throw this.createRegionNotFoundError(request);
    }

    this.validateReplacementIds(currentRegions, request);
    const nextRegions = new Map(currentRegions);
    nextRegions.delete(request.regionId);
    request.replacements.forEach(regionData => {
      nextRegions.set(regionData.id, this.cloneRegionData(regionData));
    });
    this.mockRegions.set(request.trackId, nextRegions);
    this.graphRevision += 1;
  }

  async prepareProjectGraph({
    tracks,
    masterVolume = 1,
    routingGraph = createDefaultRoutingGraphSnapshot(tracks.map(track => track.id)),
  }: PrepareAudioProjectGraphRequest): Promise<IPreparedAudioProjectGraph> {
    const expectedRevision = this.graphRevision;
    assertValidRoutingGraphSnapshot(
      routingGraph,
      tracks.map(track => track.id)
    );
    const nextTracks = new Map<string, MockTrackState>();
    const nextRegions = new Map<string, Map<string, RegionData>>();
    const nextPlugins = new Map<string, Map<string, MockPluginState>>();
    const nextLoopStates = new Map<string, LoopRuntimeState>();
    const nextMidiTracks = new Map<string, MidiTrackState>();

    tracks.forEach(track => {
      if (nextTracks.has(track.id)) {
        throw new AudioEngineError(AudioEngineErrorCode.TRACK_INIT_FAILED, ERROR_MESSAGES.TRACK_INIT_FAILED, {
          trackId: track.id,
        });
      }

      const trackRegions = new Map<string, RegionData>();
      track.regions.forEach(region => {
        if (trackRegions.has(region.id)) {
          throw new AudioEngineError(AudioEngineErrorCode.REGION_ID_CONFLICT, ERROR_MESSAGES.REGION_ID_CONFLICT, {
            regionId: region.id,
            trackId: track.id,
          });
        }
        trackRegions.set(region.id, this.cloneRegionData(region));
      });
      const trackPlugins = new Map<string, MockPluginState>();
      track.pluginInstances.forEach(instance => {
        if (trackPlugins.has(instance.instanceId)) {
          throw new AudioEngineError(
            AudioEngineErrorCode.PLUGIN_INSTANCE_ID_CONFLICT,
            ERROR_MESSAGES.PLUGIN_INSTANCE_ID_CONFLICT,
            { instanceId: instance.instanceId, trackId: track.id }
          );
        }
        trackPlugins.set(instance.instanceId, {
          manifestId: instance.manifestId,
          isEnabled: instance.isEnabled,
          parameters: new Map(instance.parameterValues),
          sidechainSourceTrackId: instance.sidechainSourceTrackId ?? null,
        });
      });
      nextTracks.set(track.id, {
        muted: track.isMuted,
        pan: track.pan,
        soloed: track.isSoloed,
        volume: track.volume,
      });
      nextRegions.set(track.id, trackRegions);
      nextPlugins.set(track.id, trackPlugins);
      if (track.midi) {
        nextMidiTracks.set(track.id, cloneMidiTrackState(track.midi));
      }
      (track.loops ?? []).forEach(loop => {
        const loopKey = this.createLoopKey({ slotId: loop.slotId, trackId: track.id });
        if (nextLoopStates.has(loopKey)) {
          throw new Error(`중복된 루프 슬롯입니다: ${loop.slotId}`);
        }
        nextLoopStates.set(loopKey, 'stopped');
      });
    });

    let retiredGraph: IRetiredAudioProjectGraph | undefined;
    let state: 'activated' | 'discarded' | 'prepared' = 'prepared';
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
        this.mockTracks = nextTracks;
        this.mockRegions = nextRegions;
        this.mockPlugins = nextPlugins;
        this.mockLoopStates = nextLoopStates;
        this.mockMidiTracks = nextMidiTracks;
        this.mockMasterVolume = masterVolume;
        this.mockRoutingGraph = cloneRoutingGraphSnapshot(routingGraph);
        this.mockTime = 0;
        this.graphRevision += 1;
        state = 'activated';
        retiredGraph = { dispose: () => COMPLETE_RESOURCE_CLEANUP };
        return retiredGraph;
      },
      discard: () => {
        if (state === 'activated') {
          return COMPLETE_RESOURCE_CLEANUP;
        }
        state = 'discarded';
        return COMPLETE_RESOURCE_CLEANUP;
      },
    };
  }

  async exportProject(request: ExportRequest): Promise<Blob> {
    console.log('[MockAudioEngine] Exporting project', request);
    return new Blob(['mock-audio-data'], { type: 'audio/wav' });
  }

  async startRenderJob(request: StartRenderJobRequest): Promise<RenderJobResult> {
    const fileCount =
      request.preset.exportMode === 'stems' ? request.ranges.length * request.tracks.length : request.ranges.length;
    this.updateMockRenderJobState({
      completedFileCount: 0,
      errorMessage: null,
      jobId: request.jobId,
      outputFileCount: fileCount,
      progress: 0,
      stage: 'rendering',
      status: 'running',
    });
    const files = request.ranges.flatMap(range => {
      const tracks = request.preset.exportMode === 'stems' ? request.tracks : [null];
      return tracks.map(track => ({
        analysis: {
          integratedLufs: -14,
          loudnessRangeLu: 0,
          normalizationGainDb: 0,
          samplePeakDbfs: -1,
          truePeakDbtp: -1,
        },
        blob: new Blob(['mock-audio-data'], { type: 'audio/wav' }),
        fileName: `${range.name}${track ? `-${track.id}` : ''}.wav`,
        rangeId: range.id,
        trackId: track?.id ?? null,
      }));
    });
    this.updateMockRenderJobState({
      ...this.mockRenderJobState,
      completedFileCount: files.length,
      progress: 1,
      stage: 'encoding',
      status: 'completed',
    });
    return { files, jobId: request.jobId };
  }

  cancelRenderJob(jobId: string): void {
    if (this.mockRenderJobState.jobId !== jobId || this.mockRenderJobState.status !== 'running') {
      return;
    }
    this.updateMockRenderJobState({ ...this.mockRenderJobState, status: 'cancelled' });
  }

  getRenderJobState(): RenderJobState {
    return { ...this.mockRenderJobState };
  }

  subscribeRenderJobState(listener: RenderJobStateListener): () => void {
    this.renderJobStateListeners.add(listener);
    return () => this.renderJobStateListeners.delete(listener);
  }

  private updateMockRenderJobState(state: RenderJobState): void {
    this.mockRenderJobState = { ...state };
    this.renderJobStateListeners.forEach(listener => listener({ ...state }));
  }

  private initializeTrack(trackId: string): void {
    if (!this.mockTracks.has(trackId)) {
      this.mockTracks.set(trackId, { muted: false, pan: 0, soloed: false, volume: 1 });
    }
    if (!this.mockRegions.has(trackId)) {
      this.mockRegions.set(trackId, new Map());
    }
    if (!this.mockPlugins.has(trackId)) {
      this.mockPlugins.set(trackId, new Map());
    }
  }

  private createLoopKey(address: LoopSlotAddress): string {
    return `${address.trackId}\u0000${address.slotId}`;
  }

  private setMockLoopState(address: LoopSlotAddress, state: LoopRuntimeState): void {
    this.mockLoopStates.set(this.createLoopKey(address), state);
    this.emitLoopEvent({ ...address, state, type: 'STATE_CHANGED' });
  }

  private getTrack(trackId: string): MockTrackState {
    const track = this.mockTracks.get(trackId);
    if (!track) {
      throw new AudioEngineError(AudioEngineErrorCode.TRACK_NOT_FOUND, ERROR_MESSAGES.TRACK_NOT_FOUND, { trackId });
    }
    return track;
  }

  private getTrackPlugins(trackId: string): Map<string, MockPluginState> {
    this.getTrack(trackId);
    const plugins = this.mockPlugins.get(trackId);
    if (!plugins) {
      throw new AudioEngineError(AudioEngineErrorCode.TRACK_NOT_FOUND, ERROR_MESSAGES.TRACK_NOT_FOUND, { trackId });
    }
    return plugins;
  }

  private createPluginInstanceNotFoundError(trackId: string, instanceId: string): AudioEngineError {
    return new AudioEngineError(
      AudioEngineErrorCode.PLUGIN_INSTANCE_NOT_FOUND,
      ERROR_MESSAGES.PLUGIN_INSTANCE_NOT_FOUND,
      { instanceId, trackId }
    );
  }

  private validatePluginTargetIndex({
    trackId,
    instanceId,
    targetIndex,
    maximumIndex,
  }: MoveAudioPluginRequest & { readonly maximumIndex: number }): void {
    if (Number.isInteger(targetIndex) && targetIndex >= 0 && targetIndex <= maximumIndex) {
      return;
    }
    throw new AudioEngineError(
      AudioEngineErrorCode.PLUGIN_TARGET_INDEX_OUT_OF_RANGE,
      ERROR_MESSAGES.PLUGIN_TARGET_INDEX_OUT_OF_RANGE,
      { instanceId, maximumIndex, targetIndex, trackId }
    );
  }

  private validateReplacementIds(currentRegions: Map<string, RegionData>, request: ReplaceRegionRequest): void {
    const replacementIds = new Set<string>();
    const hasConflict = request.replacements.some(replacement => {
      if (replacementIds.has(replacement.id)) {
        return true;
      }
      replacementIds.add(replacement.id);
      return replacement.id !== request.regionId && currentRegions.has(replacement.id);
    });

    if (hasConflict) {
      throw new AudioEngineError(AudioEngineErrorCode.REGION_ID_CONFLICT, ERROR_MESSAGES.REGION_ID_CONFLICT, {
        trackId: request.trackId,
        regionId: request.regionId,
      });
    }
  }

  private createRegionNotFoundError(request: { trackId: string; regionId: string }): AudioEngineError {
    return new AudioEngineError(AudioEngineErrorCode.REGION_NOT_FOUND, ERROR_MESSAGES.REGION_NOT_FOUND, {
      trackId: request.trackId,
      regionId: request.regionId,
    });
  }

  private cloneRegionData(regionData: RegionData): RegionData {
    return { ...regionData, fadeIn: { ...regionData.fadeIn }, fadeOut: { ...regionData.fadeOut } };
  }
}

function createMeterTargetKey(target: MeterTarget): string {
  return target.kind === 'track' ? `track:${target.trackId}` : target.kind;
}

function createSilentMeterChannel(): MeterFrame['channels'][number] {
  return { isClipHeld: false, peakDbfs: -Infinity, rmsDbfs: -Infinity };
}

function cloneMeterFrame(frame: MeterFrame): MeterFrame {
  return {
    capturedAtSeconds: frame.capturedAtSeconds,
    channels: frame.channels.map(channel => ({ ...channel })),
  };
}
