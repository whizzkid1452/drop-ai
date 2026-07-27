import { AudioEngineError, AudioEngineErrorCode, ERROR_MESSAGES } from './errors';
import { COMPLETE_RESOURCE_CLEANUP } from '../shared/types/resource-cleanup';
import { insertArrayEntry, moveArrayEntry } from '../shared/array-order';
import type {
  ExportRequest,
  ArmLoopRequest,
  IAudioEngine,
  InstallAudioPluginRequest,
  LoadLoopRequest,
  LoopRuntimeEvent,
  LoopRuntimeListener,
  LoopRuntimeState,
  LoopSlotAddress,
  MoveAudioPluginRequest,
  IPreparedAudioProjectGraph,
  IRetiredAudioProjectGraph,
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
import type { PluginParameterValue } from '../shared/types/plugin-state';

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
}

export class MockAudioEngine implements IAudioEngine {
  private mockTime = 0;
  private mockMasterVolume = 1;
  private mockTracks: Map<string, MockTrackState> = new Map();
  private mockRegions: Map<string, Map<string, RegionData>> = new Map();
  private mockPlugins: Map<string, Map<string, MockPluginState>> = new Map();
  private graphRevision = 0;
  private mockInputDeviceId: string | null = null;
  private mockLoopStates = new Map<string, LoopRuntimeState>();
  private readonly loopListeners = new Set<LoopRuntimeListener>();

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

  async setLiveInputDevice(deviceId: string | null): Promise<string | null> {
    this.mockInputDeviceId = deviceId;
    return this.mockInputDeviceId;
  }

  async setLiveInputMonitoring(request: SetLiveInputMonitoringRequest): Promise<void> {
    if (request.enabled) {
      this.getTrack(request.trackId);
    }
  }

  async armLoop(request: ArmLoopRequest): Promise<void> {
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

  async addTrack(trackId: string): Promise<void> {
    this.initializeTrack(trackId);
    this.graphRevision += 1;
    console.log(`[MockAudioEngine] Track added: ${trackId}`);
  }

  removeTrack(trackId: string): void {
    this.mockTracks.delete(trackId);
    this.mockRegions.delete(trackId);
    this.mockPlugins.delete(trackId);
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
  }: PrepareAudioProjectGraphRequest): Promise<IPreparedAudioProjectGraph> {
    const expectedRevision = this.graphRevision;
    const nextTracks = new Map<string, MockTrackState>();
    const nextRegions = new Map<string, Map<string, RegionData>>();
    const nextPlugins = new Map<string, Map<string, MockPluginState>>();
    const nextLoopStates = new Map<string, LoopRuntimeState>();

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
        this.mockMasterVolume = masterVolume;
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
    return { ...regionData };
  }
}
