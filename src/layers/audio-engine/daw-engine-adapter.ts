import {
  AudioEngine as DawAudioEngine,
  Region,
  Session,
  Source,
  TrackType,
  type AudioProvider,
  type FrameCount,
  type RegionId,
} from '@daw-engine/core/browser-adapter';
import type {
  ArmLoopRequest,
  ExportRequest,
  IAudioEngine,
  InstallAudioPluginRequest,
  IPreparedAudioProjectGraph,
  LoadLoopRequest,
  LoopRuntimeListener,
  LoopSlotAddress,
  MoveAudioPluginRequest,
  PrepareAudioProjectGraphRequest,
  RegionData,
  ReplaceRegionRequest,
  RescheduleRegionRequest,
  SetAudioPluginEnabledRequest,
  SetAudioPluginParameterRequest,
  SetLiveInputMonitoringRequest,
  StopAllLoopsRequest,
  TriggerLoopRequest,
} from './i-audio-engine';

const DAW_SAMPLE_RATE = 44_100;
const MINIMUM_REGION_FRAMES = 1;
const FADER_PROCESSOR_TYPE = 'Fader';
const PANNER_PROCESSOR_TYPE = 'Panner';

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

class DawAudioProviderBridge {
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
    const unsupported = (): never => {
      throw new Error('drop-ai adapter에서 지원하지 않는 DAW Engine AudioProvider 기능입니다.');
    };
    const noOperation = (): void => undefined;

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
      // drop-ai runtime이 Track 내부 graph를 조립하므로 DAW Route IO 식별자는 전달하지 않는다.
      connectIO: noOperation,
      disconnectIO: noOperation,
      addProcessor: (trackId, processorId, type) => this.#rememberProcessor(trackId, processorId, type),
      removeProcessor: noOperation,
      setProcessorParameter: (trackId, processorId, parameter, value) =>
        this.#setProcessorParameter({ parameter, processorId, trackId, value }),
      setProcessorAutomation: noOperation,
      setTrackGain: (trackId, gain) =>
        this.#runUnlessSuppressed(() => this.#runtime.setTrackVolume(trackId, decibelsToLinearGain(gain))),
      setTrackPan: (trackId, pan) => this.#runUnlessSuppressed(() => this.#runtime.setTrackPan(trackId, pan)),
      setMonitor: noOperation,
      setTrackMute: (trackId, muted) => this.#runUnlessSuppressed(() => this.#runtime.setTrackMute(trackId, muted)),
      setTrackSolo: (trackId, soloed) => this.#runUnlessSuppressed(() => this.#runtime.setTrackSolo(trackId, soloed)),
      setTrackSoloIsolate: noOperation,
      setTrackSoloSafe: noOperation,
      setMonitorMode: noOperation,
      scheduleRegion: (trackId, region) => this.#scheduleRegion(trackId, region),
      updateRegions: (trackId, regions) => this.#updateRegionStarts(trackId, regions),
      removeRegion: (trackId, regionId) =>
        this.#runUnlessSuppressed(() => this.#runtime.removeRegion(trackId, regionId)),
      getMeterLevel: unsupported,
      getMeterData: unsupported,
      getMasterMeterData: unsupported,
      getAnalyserNode: () => null,
      getAudioBuffer: async () => null,
      addAudioBuffer: noOperation,
      prepareRecording: unsupported,
      startRecording: unsupported,
      stopRecording: unsupported,
      enablePunchRecording: noOperation,
      setPunchRange: noOperation,
      setRecordingMuted: noOperation,
      setMonitorWithEffects: noOperation,
      getInputLatencyMs: () => 0,
      getCurrentFrame: () => secondsToFrames(this.#runtime.getCurrentTime()),
      getCurrentTime: () => this.#runtime.getCurrentTime(),
      setTempo: noOperation,
      cacheBlob: async () => undefined,
      enableMetronome: noOperation,
      setMetronomeVolume: noOperation,
      addSource: source => {
        this.#sourceUrls.set(source.id, source.url);
        return Promise.resolve();
      },
      getEngineType: () => 'ToneFallback',
      exportAudio: unsupported,
      renderRegionsToBuffer: unsupported,
      setMasterGain: gain => this.#runUnlessSuppressed(() => this.#runtime.setMasterVolume(decibelsToLinearGain(gain))),
      addMasterProcessor: noOperation,
      removeMasterProcessor: noOperation,
      setMasterProcessorParameter: noOperation,
      registerMasterIO: noOperation,
      addSendBus: noOperation,
      removeSendBus: noOperation,
      setSendBusLevel: noOperation,
      setSendBusPreFader: noOperation,
      setSendBusActive: noOperation,
      auditionRegion: unsupported,
      stopAudition: noOperation,
      stripSilence: unsupported,
      normalizeRegion: unsupported,
      createMidiTrack: unsupported,
      scheduleMidiRegion: unsupported,
      removeMidiRegion: unsupported,
      setMidiInstrument: unsupported,
      enableLoop: noOperation,
      setLoopRange: noOperation,
      midiPanic: noOperation,
      getMasterStereoMeterData: unsupported,
      reverseRegionBuffer: unsupported,
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
