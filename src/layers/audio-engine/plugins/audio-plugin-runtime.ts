import type * as Tone from 'tone';
import type { PluginParameterValue } from '../../shared/types/plugin-state';
import type { IAutomationAudioTarget } from '../automation/automation-param-scheduler';

export interface CreateAudioPluginRuntimeRequest {
  readonly instanceId: string;
  readonly parameterValues: ReadonlyMap<string, PluginParameterValue>;
  readonly stateBlob?: string | null;
}

export interface IAudioPluginRuntime {
  readonly inputNode: Tone.ToneAudioNode;
  readonly instanceId: string;
  readonly manifestId: string;
  readonly latencySamples?: number;
  readonly sidechainInputNode?: Tone.ToneAudioNode;
  connect(destination: Tone.ToneAudioNode): void;
  disconnect(): void;
  dispose(): void;
  setParameter(parameterId: string, value: PluginParameterValue): void;
  getAutomationTarget?(parameterId: string): IAutomationAudioTarget | null;
  serializeState?(): string | null;
}

export interface IAudioPluginRuntimeFactory {
  readonly manifestId: string;
  create(request: CreateAudioPluginRuntimeRequest): IAudioPluginRuntime;
}
