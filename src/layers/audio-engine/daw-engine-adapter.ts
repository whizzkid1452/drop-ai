import {
  AudioEngine as DawAudioEngine,
  Region,
  Session,
  Source,
  TrackType,
  type AudioProvider,
  type FrameCount,
  type RegionId,
} from '@daw-engine-source/browser-adapter';
import type {
  ArmLoopRequest,
  ExportRequest,
  IAudioEngine,
  InstallAudioPluginRequest,
  IPreparedAudioProjectGraph,
  LoadLoopRequest,
  LoopRuntimeListener,
  LoopSlotAddress,
  MeterFrame,
  MeterTarget,
  MoveAudioPluginRequest,
  PrepareAudioProjectGraphRequest,
  RegionData,
  ReplaceRegionRequest,
  RescheduleRegionRequest,
  SetAudioTempoMapRequest,
  SetAudioPluginEnabledRequest,
  SetAudioPluginParameterRequest,
  SetLiveInputMonitoringRequest,
  StopAllLoopsRequest,
  TriggerLoopRequest,
} from './i-audio-engine';
import type { TimelineRange } from '../shared/types/project-document.schema';
import { UnsupportedAudioFeatureError } from './errors';
import {
  AudioRuntimeFeature,
  type AudioRuntimeFeature as AudioRuntimeFeatureName,
} from '../shared/utils/audio-runtime-capabilities';

const DAW_SAMPLE_RATE = 44_100;
const MINIMUM_REGION_FRAMES = 1;
const FADER_PROCESSOR_TYPE = 'Fader';
const PANNER_PROCESSOR_TYPE = 'Panner';

type AudioProviderSupport = 'adapter-handled' | 'runtime-delegated' | 'unsupported';

export const DAW_AUDIO_PROVIDER_SUPPORT = {
  addAudioBuffer: 'adapter-handled',
  addMasterProcessor: 'adapter-handled',
  addProcessor: 'adapter-handled',
  addSendBus: 'unsupported',
  addSource: 'adapter-handled',
  auditionRegion: 'unsupported',
  cacheBlob: 'adapter-handled',
  connectIO: 'adapter-handled',
  createAuxTrack: 'runtime-delegated',
  createBusTrack: 'runtime-delegated',
  createMidiTrack: 'unsupported',
  createTrack: 'runtime-delegated',
  deleteTrack: 'runtime-delegated',
  disconnectIO: 'adapter-handled',
  enableLoop: 'adapter-handled',
  enableMetronome: 'adapter-handled',
  enablePunchRecording: 'unsupported',
  exportAudio: 'unsupported',
  getAnalyserNode: 'unsupported',
  getAudioBuffer: 'unsupported',
  getCurrentFrame: 'runtime-delegated',
  getCurrentTime: 'runtime-delegated',
  getEngineType: 'adapter-handled',
  getInputLatencyMs: 'unsupported',
  getMasterMeterData: 'unsupported',
  getMasterStereoMeterData: 'unsupported',
  getMeterData: 'unsupported',
  getMeterLevel: 'unsupported',
  initialize: 'adapter-handled',
  midiPanic: 'unsupported',
  normalizeRegion: 'unsupported',
  pause: 'runtime-delegated',
  prepareRecording: 'unsupported',
  registerMasterIO: 'adapter-handled',
  removeMasterProcessor: 'adapter-handled',
  removeMidiRegion: 'unsupported',
  removeProcessor: 'adapter-handled',
  removeRegion: 'runtime-delegated',
  removeSendBus: 'unsupported',
  renderRegionsToBuffer: 'unsupported',
  reverseRegionBuffer: 'unsupported',
  scheduleMidiRegion: 'unsupported',
  scheduleRegion: 'runtime-delegated',
  seek: 'runtime-delegated',
  setMasterGain: 'runtime-delegated',
  setMasterProcessorParameter: 'adapter-handled',
  setLoopRange: 'adapter-handled',
  setMetronomeVolume: 'adapter-handled',
  setMidiInstrument: 'unsupported',
  setMonitor: 'unsupported',
  setMonitorMode: 'unsupported',
  setMonitorWithEffects: 'unsupported',
  setProcessorAutomation: 'unsupported',
  setProcessorParameter: 'runtime-delegated',
  setPunchRange: 'unsupported',
  setRecordingMuted: 'unsupported',
  setSendBusActive: 'unsupported',
  setSendBusLevel: 'unsupported',
  setSendBusPreFader: 'unsupported',
  setTempo: 'adapter-handled',
  setTrackGain: 'runtime-delegated',
  setTrackMute: 'runtime-delegated',
  setTrackPan: 'runtime-delegated',
  setTrackSolo: 'runtime-delegated',
  setTrackSoloIsolate: 'unsupported',
  setTrackSoloSafe: 'unsupported',
  start: 'runtime-delegated',
  startRecording: 'unsupported',
  stop: 'runtime-delegated',
  stopAudition: 'unsupported',
  stopRecording: 'unsupported',
  stripSilence: 'unsupported',
  updateRegions: 'runtime-delegated',
} as const satisfies Readonly<Record<keyof AudioProvider, AudioProviderSupport>>;

function createUnsupportedAudioProviderMethod<MethodName extends keyof AudioProvider>(
  feature: AudioRuntimeFeatureName,
  method: MethodName
): AudioProvider[MethodName] {
  return ((...parameters: unknown[]) => {
    void parameters;
    throw new UnsupportedAudioFeatureError({ feature, method: String(method) });
  }) as AudioProvider[MethodName];
}

interface DawEngineAdapterOptions {
  readonly runtime: IAudioEngine;
}

export class DawEngineAdapter implements IAudioEngine {
  readonly #runtime: IAudioEngine;
  readonly #providerBridge: DawAudioProviderBridge;
  readonly #engine: DawAudioEngine;

  constructor({ runtime }: DawEngineAdapterOptions) {
    this.#runtime = runtime;
    this.#providerBridge = new DawAudioProviderBridge(runtime);
    this.#engine = DawAudioEngine.create(this.#providerBridge.audioProvider);
  }

  play(): Promise<void> {
    return this.#engine.start();
  }

  pause(): void {
    this.#engine.pause();
  }

  stop(): void {
    this.#engine.stop();
  }

  setTime(time: number): void {
    this.#engine.seek(time);
  }

  getCurrentTime(): number {
    return this.#engine.getCurrentTime();
  }

  getFeatureSupport() {
    return this.#runtime.getFeatureSupport();
  }

  setTempoMap(request: SetAudioTempoMapRequest): void {
    this.#runtime.setTempoMap(request);
  }

  setLoopRange(range: TimelineRange | null): void {
    this.#runtime.setLoopRange(range);
  }

  setLoopEnabled(isEnabled: boolean): void {
    this.#runtime.setLoopEnabled(isEnabled);
  }

  setMetronomeEnabled(isEnabled: boolean): void {
    this.#runtime.setMetronomeEnabled(isEnabled);
  }

  setMetronomeVolume(volume: number): void {
    this.#runtime.setMetronomeVolume(volume);
  }

  readMeterFrame(target: MeterTarget): MeterFrame {
    return this.#runtime.readMeterFrame(target);
  }

  setLiveInputDevice(deviceId: string | null): Promise<string | null> {
    return this.#runtime.setLiveInputDevice(deviceId);
  }

  setLiveInputMonitoring(request: SetLiveInputMonitoringRequest): Promise<void> {
    return this.#runtime.setLiveInputMonitoring(request);
  }

  armLoop(request: ArmLoopRequest): Promise<void> {
    return this.#runtime.armLoop(request);
  }

  armLoopOverdub(request: ArmLoopRequest): Promise<void> {
    return this.#runtime.armLoopOverdub(request);
  }

  cancelLoop(address: LoopSlotAddress): void {
    this.#runtime.cancelLoop(address);
  }

  triggerLoop(request: TriggerLoopRequest): Promise<void> {
    return this.#runtime.triggerLoop(request);
  }

  stopLoop(request: TriggerLoopRequest): void {
    this.#runtime.stopLoop(request);
  }

  clearLoop(address: LoopSlotAddress): void {
    this.#runtime.clearLoop(address);
  }

  stopAllLoops(request: StopAllLoopsRequest): void {
    this.#runtime.stopAllLoops(request);
  }

  loadLoop(request: LoadLoopRequest): Promise<void> {
    return this.#runtime.loadLoop(request);
  }

  subscribeLoopEvents(listener: LoopRuntimeListener): () => void {
    return this.#runtime.subscribeLoopEvents(listener);
  }

  setMasterVolume(volume: number): void {
    this.#engine.session.masterBus.volume = linearGainToDecibels(volume);
  }

  async addTrack(trackId: string): Promise<void> {
    this.#engine.addTrack(trackId, TrackType.AUDIO, trackId);
    await this.#providerBridge.waitForTrack(trackId);
  }

  removeTrack(trackId: string): void {
    this.#engine.removeTrack(trackId);
  }

  setTrackVolume(trackId: string, volume: number): void {
    this.#engine.setTrackGain(trackId, linearGainToDecibels(volume));
  }

  setTrackPan(trackId: string, pan: number): void {
    this.#engine.setTrackPan(trackId, pan);
  }

  setTrackMute(trackId: string, muted: boolean): void {
    this.#engine.session.getTrack(trackId)?.setMute(muted);
  }

  setTrackSolo(trackId: string, soloed: boolean): void {
    this.#engine.session.getTrack(trackId)?.setSolo(soloed);
  }

  getTrackParams(trackId: string): { volume: number; pan: number } | null {
    const track = this.#engine.session.getTrack(trackId);
    if (!track) {
      return null;
    }
    return {
      pan: track.route.pan,
      volume: decibelsToLinearGain(track.route.volume),
    };
  }

  installPlugin(request: InstallAudioPluginRequest): void {
    this.#runtime.installPlugin(request);
  }

  removePlugin(trackId: string, instanceId: string): void {
    this.#runtime.removePlugin(trackId, instanceId);
  }

  movePlugin(request: MoveAudioPluginRequest): void {
    this.#runtime.movePlugin(request);
  }

  setPluginEnabled(request: SetAudioPluginEnabledRequest): void {
    this.#runtime.setPluginEnabled(request);
  }

  setPluginParameter(request: SetAudioPluginParameterRequest): void {
    this.#runtime.setPluginParameter(request);
  }

  async addRegion(trackId: string, regionData: RegionData): Promise<void> {
    const track = this.#engine.session.getTrack(trackId);
    if (!track) {
      throw new Error(`DAW Engine Track을 찾을 수 없습니다: ${trackId}`);
    }

    const sourceId = createSourceId(trackId, regionData.id);
    this.#providerBridge.stageRegion({ regionData, sourceId, trackId });
    this.#engine.session.addSource(createDawSource(sourceId, regionData));
    track.playlist.addRegion(createDawRegion(sourceId, regionData));
    await this.#providerBridge.waitForRegion({ regionId: regionData.id, trackId });
  }

  removeRegion(trackId: string, regionId: string): void {
    this.#engine.session.getTrack(trackId)?.playlist.removeRegion(regionId);
  }

  rescheduleRegion(request: RescheduleRegionRequest): void {
    this.#runtime.rescheduleRegion(request);
    this.#providerBridge.runSuppressed(() => {
      const region = this.#engine.session.getTrack(request.trackId)?.playlist.getRegion(request.regionId);
      region?.move(secondsToFrames(request.startTime));
    });
  }

  async replaceRegion(request: ReplaceRegionRequest): Promise<void> {
    await this.#runtime.replaceRegion(request);
    this.#providerBridge.runSuppressed(() => {
      const track = this.#engine.session.getTrack(request.trackId);
      track?.playlist.removeRegion(request.regionId);
      request.replacements.forEach(replacement => {
        const sourceId = createSourceId(request.trackId, replacement.id);
        this.#providerBridge.stageRegion({ regionData: replacement, sourceId, trackId: request.trackId });
        this.#engine.session.addSource(createDawSource(sourceId, replacement));
        track?.playlist.addRegion(createDawRegion(sourceId, replacement));
      });
    });
  }

  async prepareProjectGraph(request: PrepareAudioProjectGraphRequest): Promise<IPreparedAudioProjectGraph> {
    const nextSession = createDawSession(request);
    const preparedRuntime = await this.#runtime.prepareProjectGraph(request);
    return {
      assertActivatable: () => preparedRuntime.assertActivatable(),
      activate: () => {
        const retiredRuntime = preparedRuntime.activate();
        // Runtime 교체가 끝난 뒤 같은 snapshot을 DAW domain에 반영해 이후 signal이 새 graph를 대상으로 동작하게 한다.
        this.#providerBridge.indexSession(nextSession);
        this.#providerBridge.runSuppressed(() => this.#engine.loadSession(nextSession));
        return retiredRuntime;
      },
      discard: () => preparedRuntime.discard(),
    };
  }

  exportProject(request: ExportRequest): Promise<Blob> {
    return this.#runtime.exportProject(request);
  }
}

interface StageRegionRequest {
  readonly regionData: RegionData;
  readonly sourceId: string;
  readonly trackId: string;
}

interface RegionAddress {
  readonly regionId: string;
  readonly trackId: string;
}

export class DawAudioProviderBridge {
  readonly audioProvider: AudioProvider;
  readonly #runtime: IAudioEngine;
  readonly #processorTypes = new Map<string, Map<string, string>>();
  readonly #sourceUrls = new Map<string, string>();
  readonly #stagedRegions = new Map<string, RegionData>();
  readonly #pendingTracks = new Map<string, Promise<void>>();
  readonly #pendingRegions = new Map<string, Promise<void>>();
  #isSuppressed = false;

  constructor(runtime: IAudioEngine) {
    this.#runtime = runtime;
    this.audioProvider = this.#createAudioProvider();
  }

  stageRegion({ regionData, sourceId, trackId }: StageRegionRequest): void {
    this.#sourceUrls.set(sourceId, regionData.url);
    this.#stagedRegions.set(createRegionKey({ regionId: regionData.id, trackId }), regionData);
  }

  indexSession(session: Session): void {
    session.sources.forEach(source => {
      this.#sourceUrls.set(source.id, source.url);
    });
    session.tracks.forEach(track => {
      track.route.processors.forEach(processor => {
        this.#rememberProcessor(track.id, processor.id, processor.name);
      });
    });
  }

  async waitForTrack(trackId: string): Promise<void> {
    const pendingTrack = this.#pendingTracks.get(trackId);
    await pendingTrack;
    if (this.#pendingTracks.get(trackId) === pendingTrack) {
      this.#pendingTracks.delete(trackId);
    }
  }

  async waitForRegion(address: RegionAddress): Promise<void> {
    const regionKey = createRegionKey(address);
    const pendingRegion = this.#pendingRegions.get(regionKey);
    await pendingRegion;
    if (this.#pendingRegions.get(regionKey) === pendingRegion) {
      this.#pendingRegions.delete(regionKey);
    }
  }

  runSuppressed<Result>(operation: () => Result): Result {
    const wasSuppressed = this.#isSuppressed;
    this.#isSuppressed = true;
    try {
      return operation();
    } finally {
      this.#isSuppressed = wasSuppressed;
    }
  }

  #createAudioProvider(): AudioProvider {
    return {
      initialize: async () => undefined,
      start: () => this.#runUnlessSuppressed(() => this.#runtime.play()),
      stop: () => this.#runUnlessSuppressed(() => this.#runtime.stop()),
      pause: () => this.#runUnlessSuppressed(() => this.#runtime.pause()),
      seek: time => this.#runUnlessSuppressed(() => this.#runtime.setTime(time)),
      createTrack: trackId => this.#createTrack(trackId),
      createAuxTrack: trackId => this.#createTrack(trackId),
      createBusTrack: trackId => this.#createTrack(trackId),
      deleteTrack: trackId => this.#runUnlessSuppressed(() => this.#runtime.removeTrack(trackId)),
      // 실제 연결 graph는 product runtime이 소유하므로 DAW Route 연결은 projection으로만 유지한다.
      connectIO: (sourceId, destinationId) => {
        void sourceId;
        void destinationId;
      },
      disconnectIO: (sourceId, destinationId) => {
        void sourceId;
        void destinationId;
      },
      addProcessor: (trackId, processorId, type) => this.#rememberProcessor(trackId, processorId, type),
      removeProcessor: (trackId, processorId) => this.#forgetProcessor(trackId, processorId),
      setProcessorParameter: (trackId, processorId, parameter, value) =>
        this.#setProcessorParameter({ parameter, processorId, trackId, value }),
      setProcessorAutomation: createUnsupportedAudioProviderMethod(
        AudioRuntimeFeature.AUTOMATION,
        'setProcessorAutomation'
      ),
      setTrackGain: (trackId, gain) =>
        this.#runUnlessSuppressed(() => this.#runtime.setTrackVolume(trackId, decibelsToLinearGain(gain))),
      setTrackPan: (trackId, pan) => this.#runUnlessSuppressed(() => this.#runtime.setTrackPan(trackId, pan)),
      setMonitor: createUnsupportedAudioProviderMethod(AudioRuntimeFeature.LIVE_INPUT, 'setMonitor'),
      setTrackMute: (trackId, muted) => this.#runUnlessSuppressed(() => this.#runtime.setTrackMute(trackId, muted)),
      setTrackSolo: (trackId, soloed) => this.#runUnlessSuppressed(() => this.#runtime.setTrackSolo(trackId, soloed)),
      setTrackSoloIsolate: createUnsupportedAudioProviderMethod(AudioRuntimeFeature.ROUTING, 'setTrackSoloIsolate'),
      setTrackSoloSafe: createUnsupportedAudioProviderMethod(AudioRuntimeFeature.ROUTING, 'setTrackSoloSafe'),
      setMonitorMode: createUnsupportedAudioProviderMethod(AudioRuntimeFeature.LIVE_INPUT, 'setMonitorMode'),
      scheduleRegion: (trackId, region) => this.#scheduleRegion(trackId, region),
      updateRegions: (trackId, regions) => this.#updateRegionStarts(trackId, regions),
      removeRegion: (trackId, regionId) =>
        this.#runUnlessSuppressed(() => this.#runtime.removeRegion(trackId, regionId)),
      getMeterLevel: createUnsupportedAudioProviderMethod(AudioRuntimeFeature.METERING, 'getMeterLevel'),
      getMeterData: createUnsupportedAudioProviderMethod(AudioRuntimeFeature.METERING, 'getMeterData'),
      getMasterMeterData: createUnsupportedAudioProviderMethod(AudioRuntimeFeature.METERING, 'getMasterMeterData'),
      getAnalyserNode: createUnsupportedAudioProviderMethod(AudioRuntimeFeature.METERING, 'getAnalyserNode'),
      getAudioBuffer: createUnsupportedAudioProviderMethod(AudioRuntimeFeature.REGION_PROCESSING, 'getAudioBuffer'),
      addAudioBuffer: (sourceId, buffer) => {
        void sourceId;
        void buffer;
      },
      prepareRecording: createUnsupportedAudioProviderMethod(AudioRuntimeFeature.LINEAR_RECORDING, 'prepareRecording'),
      startRecording: createUnsupportedAudioProviderMethod(AudioRuntimeFeature.LINEAR_RECORDING, 'startRecording'),
      stopRecording: createUnsupportedAudioProviderMethod(AudioRuntimeFeature.LINEAR_RECORDING, 'stopRecording'),
      enablePunchRecording: createUnsupportedAudioProviderMethod(
        AudioRuntimeFeature.LINEAR_RECORDING,
        'enablePunchRecording'
      ),
      setPunchRange: createUnsupportedAudioProviderMethod(AudioRuntimeFeature.LINEAR_RECORDING, 'setPunchRange'),
      setRecordingMuted: createUnsupportedAudioProviderMethod(
        AudioRuntimeFeature.LINEAR_RECORDING,
        'setRecordingMuted'
      ),
      setMonitorWithEffects: createUnsupportedAudioProviderMethod(
        AudioRuntimeFeature.LIVE_INPUT,
        'setMonitorWithEffects'
      ),
      getInputLatencyMs: createUnsupportedAudioProviderMethod(AudioRuntimeFeature.LIVE_INPUT, 'getInputLatencyMs'),
      getCurrentFrame: () => secondsToFrames(this.#runtime.getCurrentTime()),
      getCurrentTime: () => this.#runtime.getCurrentTime(),
      // 제품 Tempo Map이 단일 기준이므로 DAW Session의 단일 BPM projection이 전체 Map을 덮어쓰지 않게 한다.
      setTempo: tempoBpm => {
        void tempoBpm;
      },
      cacheBlob: async (url, blob) => {
        void url;
        void blob;
      },
      // 제품 Transport 명령이 runtime을 갱신하므로 DAW Session projection의 중복 호출은 수용만 한다.
      enableMetronome: isEnabled => {
        void isEnabled;
      },
      setMetronomeVolume: volume => {
        void volume;
      },
      addSource: source => {
        this.#sourceUrls.set(source.id, source.url);
        return Promise.resolve();
      },
      getEngineType: () => 'ToneFallback',
      exportAudio: createUnsupportedAudioProviderMethod(AudioRuntimeFeature.ADVANCED_EXPORT, 'exportAudio'),
      renderRegionsToBuffer: createUnsupportedAudioProviderMethod(
        AudioRuntimeFeature.REGION_PROCESSING,
        'renderRegionsToBuffer'
      ),
      setMasterGain: gain => this.#runUnlessSuppressed(() => this.#runtime.setMasterVolume(decibelsToLinearGain(gain))),
      addMasterProcessor: (processorId, type, index) => {
        void processorId;
        void type;
        void index;
      },
      removeMasterProcessor: processorId => {
        void processorId;
      },
      setMasterProcessorParameter: (processorId, parameter, value) => {
        void processorId;
        void parameter;
        void value;
      },
      registerMasterIO: (inputId, outputId) => {
        void inputId;
        void outputId;
      },
      addSendBus: createUnsupportedAudioProviderMethod(AudioRuntimeFeature.ROUTING, 'addSendBus'),
      removeSendBus: createUnsupportedAudioProviderMethod(AudioRuntimeFeature.ROUTING, 'removeSendBus'),
      setSendBusLevel: createUnsupportedAudioProviderMethod(AudioRuntimeFeature.ROUTING, 'setSendBusLevel'),
      setSendBusPreFader: createUnsupportedAudioProviderMethod(AudioRuntimeFeature.ROUTING, 'setSendBusPreFader'),
      setSendBusActive: createUnsupportedAudioProviderMethod(AudioRuntimeFeature.ROUTING, 'setSendBusActive'),
      auditionRegion: createUnsupportedAudioProviderMethod(AudioRuntimeFeature.REGION_PROCESSING, 'auditionRegion'),
      stopAudition: createUnsupportedAudioProviderMethod(AudioRuntimeFeature.REGION_PROCESSING, 'stopAudition'),
      stripSilence: createUnsupportedAudioProviderMethod(AudioRuntimeFeature.REGION_PROCESSING, 'stripSilence'),
      normalizeRegion: createUnsupportedAudioProviderMethod(AudioRuntimeFeature.REGION_PROCESSING, 'normalizeRegion'),
      createMidiTrack: createUnsupportedAudioProviderMethod(AudioRuntimeFeature.MIDI, 'createMidiTrack'),
      scheduleMidiRegion: createUnsupportedAudioProviderMethod(AudioRuntimeFeature.MIDI, 'scheduleMidiRegion'),
      removeMidiRegion: createUnsupportedAudioProviderMethod(AudioRuntimeFeature.MIDI, 'removeMidiRegion'),
      setMidiInstrument: createUnsupportedAudioProviderMethod(AudioRuntimeFeature.MIDI, 'setMidiInstrument'),
      enableLoop: isEnabled => {
        void isEnabled;
      },
      setLoopRange: (startTime, endTime) => {
        void startTime;
        void endTime;
      },
      midiPanic: createUnsupportedAudioProviderMethod(AudioRuntimeFeature.MIDI, 'midiPanic'),
      getMasterStereoMeterData: createUnsupportedAudioProviderMethod(
        AudioRuntimeFeature.METERING,
        'getMasterStereoMeterData'
      ),
      reverseRegionBuffer: createUnsupportedAudioProviderMethod(
        AudioRuntimeFeature.REGION_PROCESSING,
        'reverseRegionBuffer'
      ),
    };
  }

  #runUnlessSuppressed<Result>(operation: () => Result): Result | undefined {
    if (this.#isSuppressed) {
      return undefined;
    }
    return operation();
  }

  #createTrack(trackId: string): void {
    if (this.#isSuppressed) {
      return;
    }
    this.#pendingTracks.set(trackId, this.#runtime.addTrack(trackId));
  }

  #rememberProcessor(trackId: string, processorId: string, type: string): void {
    const trackProcessors = this.#processorTypes.get(trackId) ?? new Map<string, string>();
    trackProcessors.set(processorId, type);
    this.#processorTypes.set(trackId, trackProcessors);
  }

  #forgetProcessor(trackId: string, processorId: string): void {
    const trackProcessors = this.#processorTypes.get(trackId);
    trackProcessors?.delete(processorId);
    if (trackProcessors?.size === 0) {
      this.#processorTypes.delete(trackId);
    }
  }

  #setProcessorParameter({
    parameter,
    processorId,
    trackId,
    value,
  }: {
    readonly parameter: string;
    readonly processorId: string;
    readonly trackId: string;
    readonly value: number;
  }): void {
    if (this.#isSuppressed) {
      return;
    }
    const processorType = this.#processorTypes.get(trackId)?.get(processorId);
    if (processorType === FADER_PROCESSOR_TYPE && parameter === 'gain') {
      this.#runtime.setTrackVolume(trackId, decibelsToLinearGain(value));
    }
    if (processorType === PANNER_PROCESSOR_TYPE && parameter === 'pan') {
      this.#runtime.setTrackPan(trackId, value);
    }
  }

  #scheduleRegion(
    trackId: string,
    region: { id: string; sourceId: string; start: FrameCount; sourceStart: FrameCount; length: FrameCount }
  ): void {
    if (this.#isSuppressed) {
      return;
    }
    const regionKey = createRegionKey({ regionId: region.id, trackId });
    const stagedRegion = this.#stagedRegions.get(regionKey);
    const regionData: RegionData = stagedRegion ?? {
      duration: framesToSeconds(region.length),
      id: region.id,
      sourceStartTime: framesToSeconds(region.sourceStart),
      startTime: framesToSeconds(region.start),
      url: this.#sourceUrls.get(region.sourceId) ?? '',
    };
    this.#pendingRegions.set(regionKey, this.#runtime.addRegion(trackId, regionData));
  }

  #updateRegionStarts(trackId: string, regions: readonly { id: string; start: FrameCount }[]): void {
    if (this.#isSuppressed) {
      return;
    }
    regions.forEach(region => {
      this.#runtime.rescheduleRegion({
        regionId: region.id,
        startTime: framesToSeconds(region.start),
        trackId,
      });
    });
  }
}

function createDawSession(request: PrepareAudioProjectGraphRequest): Session {
  const session = new Session('drop-ai-project', undefined, DAW_SAMPLE_RATE);
  if (request.masterVolume !== undefined) {
    session.masterBus.volume = linearGainToDecibels(request.masterVolume);
  }
  request.tracks.forEach(projectTrack => {
    const track = session.addTrack(projectTrack.id, TrackType.AUDIO, projectTrack.id);
    track.route.volume = linearGainToDecibels(projectTrack.volume);
    track.route.pan = projectTrack.pan;
    track.setMute(projectTrack.isMuted);
    track.setSolo(projectTrack.isSoloed);
    projectTrack.regions.forEach(regionData => {
      const sourceId = createSourceId(projectTrack.id, regionData.id);
      session.addSource(createDawSource(sourceId, regionData));
      track.playlist.addRegion(createDawRegion(sourceId, regionData));
    });
  });
  return session;
}

function createDawSource(sourceId: string, regionData: RegionData): Source {
  return new Source(
    sourceId,
    regionData.id,
    regionData.url,
    secondsToFrames(regionData.duration ?? framesToSeconds(MINIMUM_REGION_FRAMES)),
    DAW_SAMPLE_RATE
  );
}

function createDawRegion(sourceId: string, regionData: RegionData): Region {
  return new Region(
    regionData.id as RegionId,
    sourceId,
    secondsToFrames(regionData.startTime),
    secondsToFrames(regionData.duration ?? framesToSeconds(MINIMUM_REGION_FRAMES)),
    secondsToFrames(regionData.sourceStartTime),
    regionData.id
  );
}

function createSourceId(trackId: string, regionId: string): string {
  return `${trackId}:${regionId}`;
}

function createRegionKey({ regionId, trackId }: RegionAddress): string {
  return `${trackId}\u0000${regionId}`;
}

function secondsToFrames(seconds: number): FrameCount {
  return Math.max(0, Math.round(seconds * DAW_SAMPLE_RATE));
}

function framesToSeconds(frames: FrameCount): number {
  return frames / DAW_SAMPLE_RATE;
}

function linearGainToDecibels(gain: number): number {
  return gain <= 0 ? Number.NEGATIVE_INFINITY : 20 * Math.log10(gain);
}

function decibelsToLinearGain(decibels: number): number {
  return decibels === Number.NEGATIVE_INFINITY ? 0 : 10 ** (decibels / 20);
}
