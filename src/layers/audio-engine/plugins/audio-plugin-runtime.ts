import type * as Tone from 'tone';
import type { PluginParameterValue } from '../../shared/types/plugin-state';

export interface CreateAudioPluginRuntimeRequest {
  readonly instanceId: string;
  readonly parameterValues: ReadonlyMap<string, PluginParameterValue>;
}

export interface IAudioPluginRuntime {
  readonly inputNode: Tone.ToneAudioNode;
  readonly instanceId: string;
  readonly manifestId: string;
  connect(destination: Tone.ToneAudioNode): void;
  disconnect(): void;
  dispose(): void;
  setParameter(parameterId: string, value: PluginParameterValue): void;
}

export interface IAudioPluginRuntimeFactory {
  readonly manifestId: string;
  create(request: CreateAudioPluginRuntimeRequest): IAudioPluginRuntime;
}
