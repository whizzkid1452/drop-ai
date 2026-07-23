import type { ResourceCleanupResult } from '../shared/types/resource-cleanup';
import type { PluginParameterValue } from '../shared/types/plugin-state';

export interface RegionData {
  id: string;
  url: string;
  startTime: number;
  sourceStartTime: number;
  duration?: number;
}

export const DEFAULT_EXPORT_SAMPLE_RATE = 44100;

export interface ExportRange {
  startTime: number;
  endTime: number;
}

export interface ExportRegion {
  id: string;
  url: string;
  startTime: number;
  sourceStartTime: number;
  duration: number;
}

export interface ExportTrack {
  id: string;
  volume: number;
  pan: number;
  isMuted: boolean;
  isSoloed: boolean;
  regions: ExportRegion[];
}

export interface ExportRequest {
  tracks: ExportTrack[];
  masterVolume: number;
  range: ExportRange;
  sampleRate: number;
}

export interface RescheduleRegionRequest {
  trackId: string;
  regionId: string;
  startTime: number;
}

export interface ReplaceRegionRequest {
  trackId: string;
  regionId: string;
  replacements: RegionData[];
}

export interface InstallAudioPluginRequest {
  readonly trackId: string;
  readonly instanceId: string;
  readonly manifestId: string;
  readonly parameterValues: ReadonlyMap<string, PluginParameterValue>;
}

export interface SetAudioPluginParameterRequest {
  readonly trackId: string;
  readonly instanceId: string;
  readonly parameterId: string;
  readonly value: PluginParameterValue;
}

export interface AudioProjectGraphPluginInstance {
  readonly instanceId: string;
  readonly manifestId: string;
  readonly isEnabled: boolean;
  readonly parameterValues: ReadonlyMap<string, PluginParameterValue>;
}

export interface AudioProjectGraphTrack {
  readonly id: string;
  readonly volume: number;
  readonly pan: number;
  readonly isMuted: boolean;
  readonly isSoloed: boolean;
  readonly pluginInstances: readonly AudioProjectGraphPluginInstance[];
  readonly regions: readonly RegionData[];
}

export interface PrepareAudioProjectGraphRequest {
  readonly tracks: readonly AudioProjectGraphTrack[];
}

export interface IRetiredAudioProjectGraph {
  dispose(): ResourceCleanupResult;
}

export interface IPreparedAudioProjectGraph {
  assertActivatable(): void;
  activate(): IRetiredAudioProjectGraph;
  discard(): ResourceCleanupResult;
}

export interface IAudioEngine {
  // Transport Control
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  setTime(time: number): void;
  getCurrentTime(): number;

  // Track Management
  addTrack(trackId: string): Promise<void>;
  removeTrack(trackId: string): void;
  setTrackVolume(trackId: string, volume: number): void;
  setTrackPan(trackId: string, pan: number): void;
  setTrackMute(trackId: string, muted: boolean): void;
  setTrackSolo(trackId: string, soloed: boolean): void;
  getTrackParams(trackId: string): { volume: number; pan: number } | null;

  // Plugin Management
  installPlugin(request: InstallAudioPluginRequest): void;
  removePlugin(trackId: string, instanceId: string): void;
  setPluginParameter(request: SetAudioPluginParameterRequest): void;

  // Region Management
  addRegion(trackId: string, regionData: RegionData): Promise<void>;
  removeRegion(trackId: string, regionId: string): void;
  rescheduleRegion(request: RescheduleRegionRequest): void;
  replaceRegion(request: ReplaceRegionRequest): Promise<void>;
  prepareProjectGraph(request: PrepareAudioProjectGraphRequest): Promise<IPreparedAudioProjectGraph>;

  // Export
  exportProject(request: ExportRequest): Promise<Blob>;
}
