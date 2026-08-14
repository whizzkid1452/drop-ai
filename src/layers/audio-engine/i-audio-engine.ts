import type { ResourceCleanupResult } from '../shared/types/resource-cleanup';
import type { AutomationLaneState } from '../shared/types/automation-state';
import type { MidiTrackState } from '../shared/types/midi-state';
import type { MidiInputEvent } from '../midi-input/i-midi-input';
import type { RegionProcessingState } from '../shared/types/region-processing';
import type {
  AnalyzeAudioRegionPeakRequest,
  RenderDerivedAudioRegionRequest,
  RenderedDerivedAudioRegion,
} from '../shared/types/region-audio-processing';
import type { PluginParameterValue, PluginRuntimeState } from '../shared/types/plugin-state';
import type { TimelineRange } from '../shared/types/project-document.schema';
import type { MeterFrame, MeterTarget } from '../shared/types/meter-frame';
import type { RoutingGraphSnapshot } from '../shared/types/routing-state';
import type { AudioMonitorState, AudioMonitorStateListener } from '../shared/types/audio-monitor-state';
import type { LiveAudioInputDevice, LiveInputRuntimeListener, LiveInputRuntimeState } from '../shared/types/live-input';
import type { AudioRuntimeFeatureSupport } from '../shared/utils/audio-runtime-capabilities';
import type {
  MultiTrackRecordingResult,
  RecordingRuntimeListener,
  RecordingRuntimeState,
  SetTrackRecordArmRequest,
  SetTrackRecordingInputRequest,
  StartLinearRecordingRequest,
} from '../shared/types/linear-recording';
import type {
  ArmLoopRequest,
  LoadLoopRequest,
  LoopRuntimeListener,
  LoopSlotAddress,
  SetLiveInputMonitoringRequest,
  StopAllLoopsRequest,
  TriggerLoopRequest,
} from './loop-runtime/loop-runtime-contract';

export type {
  ArmLoopRequest,
  LoadLoopRequest,
  LoopRuntimeEvent,
  LoopRuntimeListener,
  LoopRuntimeState,
  LoopSlotAddress,
  SetLiveInputMonitoringRequest,
  StopAllLoopsRequest,
  TriggerLoopRequest,
} from './loop-runtime/loop-runtime-contract';
export type { MeterChannelFrame, MeterFrame, MeterTarget } from '../shared/types/meter-frame';
export type { RoutingGraphSnapshot } from '../shared/types/routing-state';
export type { MidiNoteState, MidiRegionState, MidiTrackState } from '../shared/types/midi-state';
export type { AudioMonitorState, AudioMonitorStateListener } from '../shared/types/audio-monitor-state';
export type { LiveAudioInputDevice, LiveInputRuntimeListener, LiveInputRuntimeState } from '../shared/types/live-input';
export type {
  MultiTrackRecordingResult,
  RecordingRuntimeListener,
  RecordingRuntimeState,
  SetTrackRecordArmRequest,
  SetTrackRecordingInputRequest,
  StartLinearRecordingRequest,
} from '../shared/types/linear-recording';
export type {
  AnalyzeAudioRegionPeakRequest,
  RenderDerivedAudioRegionRequest,
  RenderedDerivedAudioRegion,
} from '../shared/types/region-audio-processing';

export interface RegionData extends RegionProcessingState {
  id: string;
  url: string;
  startTime: number;
  sourceStartTime: number;
  duration: number;
}

export const DEFAULT_EXPORT_SAMPLE_RATE = 44100;

export interface ExportRange {
  startTime: number;
  endTime: number;
}

export interface ExportRegion extends RegionProcessingState {
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
  pluginInstances: readonly AudioProjectGraphPluginInstance[];
  automationLanes?: readonly AutomationLaneState[];
  regions: ExportRegion[];
}

export interface ExportRequest {
  tracks: ExportTrack[];
  masterVolume: number;
  range: ExportRange;
  routingGraph?: RoutingGraphSnapshot;
  sampleRate: number;
}

export interface RescheduleRegionRequest {
  trackId: string;
  regionId: string;
  startTime: number;
}

export interface SetAutomationLanesRequest {
  readonly automationLanes: readonly AutomationLaneState[];
  readonly trackId: string;
}

export interface SetMidiTrackStateRequest {
  readonly midi: MidiTrackState;
  readonly trackId: string;
}

export interface SendMidiInputEventRequest {
  readonly event: MidiInputEvent;
  readonly trackId: string;
}

export interface AudioTempoChange {
  readonly quarterNotePosition: number;
  readonly bpm: number;
}

export interface SetAudioTempoMapRequest {
  readonly changes: readonly AudioTempoChange[];
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
  readonly isEnabled?: boolean;
  readonly targetIndex?: number;
  readonly parameterValues: ReadonlyMap<string, PluginParameterValue>;
  readonly stateBlob?: string | null;
  readonly sidechainSourceTrackId?: string | null;
}

export interface MoveAudioPluginRequest {
  readonly trackId: string;
  readonly instanceId: string;
  readonly targetIndex: number;
}

export interface SetAudioPluginEnabledRequest {
  readonly trackId: string;
  readonly instanceId: string;
  readonly isEnabled: boolean;
}

export interface SetAudioPluginParameterRequest {
  readonly trackId: string;
  readonly instanceId: string;
  readonly parameterId: string;
  readonly value: PluginParameterValue;
}

export interface SetAudioPluginSidechainRequest {
  readonly trackId: string;
  readonly instanceId: string;
  readonly sourceTrackId: string | null;
}

export interface AudioProjectGraphPluginInstance {
  readonly instanceId: string;
  readonly manifestId: string;
  readonly isEnabled: boolean;
  readonly parameterValues: ReadonlyMap<string, PluginParameterValue>;
  readonly stateBlob?: string | null;
  readonly sidechainSourceTrackId?: string | null;
}

export interface AudioProjectGraphLoop {
  readonly slotId: string;
  readonly url: string;
}

export interface AudioProjectGraphTrack {
  readonly id: string;
  readonly volume: number;
  readonly pan: number;
  readonly isMuted: boolean;
  readonly isSoloed: boolean;
  readonly pluginInstances: readonly AudioProjectGraphPluginInstance[];
  readonly automationLanes?: readonly AutomationLaneState[];
  readonly midi?: MidiTrackState | null;
  readonly loops?: readonly AudioProjectGraphLoop[];
  readonly regions: readonly RegionData[];
}

export interface PrepareAudioProjectGraphRequest {
  readonly masterVolume?: number;
  readonly routingGraph?: RoutingGraphSnapshot;
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
  getFeatureSupport(): AudioRuntimeFeatureSupport;

  // Transport Control
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  setTime(time: number): void;
  getCurrentTime(): number;
  setTempoMap(request: SetAudioTempoMapRequest): void;
  setLoopRange(range: TimelineRange | null): void;
  setLoopEnabled(isEnabled: boolean): void;
  setMetronomeEnabled(isEnabled: boolean): void;
  setMetronomeVolume(volume: number): void;

  // Runtime Meter Query
  readMeterFrame(target: MeterTarget): MeterFrame;

  // Live Loop Control
  getLiveInputState(): LiveInputRuntimeState;
  listLiveInputDevices(): Promise<readonly LiveAudioInputDevice[]>;
  subscribeLiveInputState(listener: LiveInputRuntimeListener): () => void;
  setLiveInputDevice(deviceId: string | null): Promise<string | null>;
  setLiveInputMonitoring(request: SetLiveInputMonitoringRequest): Promise<void>;
  armLoop(request: ArmLoopRequest): Promise<void>;
  armLoopOverdub(request: ArmLoopRequest): Promise<void>;
  cancelLoop(address: LoopSlotAddress): void;
  triggerLoop(request: TriggerLoopRequest): Promise<void>;
  stopLoop(request: TriggerLoopRequest): void;
  clearLoop(address: LoopSlotAddress): void;
  stopAllLoops(request: StopAllLoopsRequest): void;
  loadLoop(request: LoadLoopRequest): Promise<void>;
  subscribeLoopEvents(listener: LoopRuntimeListener): () => void;

  // Linear Recording
  getRecordingState(): RecordingRuntimeState;
  subscribeRecordingState(listener: RecordingRuntimeListener): () => void;
  setTrackRecordArm(request: SetTrackRecordArmRequest): void;
  setTrackRecordingInput(request: SetTrackRecordingInputRequest): void;
  startRecording(request: StartLinearRecordingRequest): Promise<void>;
  stopRecording(): Promise<MultiTrackRecordingResult>;
  cancelRecording(): void;

  // Mixer Control
  setMasterVolume(volume: number): void;
  getMonitorState(): AudioMonitorState;
  subscribeMonitorState(listener: AudioMonitorStateListener): () => void;
  setMonitorState(state: AudioMonitorState): void;
  getRoutingGraph(): RoutingGraphSnapshot;
  setRoutingGraph(graph: RoutingGraphSnapshot): void;

  // Track Management
  addTrack(trackId: string): Promise<void>;
  addMidiTrack(trackId: string): Promise<void>;
  removeTrack(trackId: string): void;
  setTrackVolume(trackId: string, volume: number): void;
  setTrackPan(trackId: string, pan: number): void;
  setTrackMute(trackId: string, muted: boolean): void;
  setTrackSolo(trackId: string, soloed: boolean): void;
  getTrackParams(trackId: string): { volume: number; pan: number } | null;
  setAutomationLanes(request: SetAutomationLanesRequest): void;
  setMidiTrackState(request: SetMidiTrackStateRequest): void;
  sendMidiInputEvent(request: SendMidiInputEventRequest): void;
  midiPanic(): void;

  // Plugin Management
  listAvailablePluginManifestIds(): readonly string[];
  readPluginRuntimeStates(trackId: string): readonly PluginRuntimeState[];
  installPlugin(request: InstallAudioPluginRequest): void;
  removePlugin(trackId: string, instanceId: string): void;
  movePlugin(request: MoveAudioPluginRequest): void;
  setPluginEnabled(request: SetAudioPluginEnabledRequest): void;
  setPluginParameter(request: SetAudioPluginParameterRequest): void;
  setPluginSidechain(request: SetAudioPluginSidechainRequest): void;

  // Region Management
  addRegion(trackId: string, regionData: RegionData): Promise<void>;
  removeRegion(trackId: string, regionId: string): void;
  rescheduleRegion(request: RescheduleRegionRequest): void;
  replaceRegion(request: ReplaceRegionRequest): Promise<void>;
  prepareProjectGraph(request: PrepareAudioProjectGraphRequest): Promise<IPreparedAudioProjectGraph>;

  // Export
  exportProject(request: ExportRequest): Promise<Blob>;
  analyzeAudioRegionPeak(request: AnalyzeAudioRegionPeakRequest): Promise<number>;
  renderDerivedAudioRegion(request: RenderDerivedAudioRegionRequest): Promise<RenderedDerivedAudioRegion>;
}
