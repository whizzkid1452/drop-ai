import * as Tone from 'tone';
import type { PluginParameterValue } from '../../shared/types/plugin-state';
import type {
  CreateAudioPluginRuntimeRequest,
  IAudioPluginRuntime,
  IAudioPluginRuntimeFactory,
} from './audio-plugin-runtime';
import { AudioPluginRuntimeError, AudioPluginRuntimeErrorCode } from './errors';
import { createMappedAutomationTarget } from '../automation/tone-automation-target';
import type { IAutomationAudioTarget } from '../automation/automation-param-scheduler';

const GAIN_RAMP_SECONDS = 0.01;

export interface ToneGainPluginRuntimeFactoryOptions {
  readonly manifestId: string;
  readonly parameterId: string;
  readonly minValue: number;
  readonly maxValue: number;
  readonly defaultValue: number;
}

export class ToneGainPluginRuntimeFactory implements IAudioPluginRuntimeFactory {
  readonly manifestId: string;
  private readonly options: ToneGainPluginRuntimeFactoryOptions;

  constructor(options: ToneGainPluginRuntimeFactoryOptions) {
    assertValidFactoryOptions(options);
    this.manifestId = options.manifestId;
    this.options = { ...options };
  }

  create(request: CreateAudioPluginRuntimeRequest): IAudioPluginRuntime {
    assertKnownParameters(request.parameterValues, this.options);
    const initialValue = request.parameterValues.get(this.options.parameterId) ?? this.options.defaultValue;
    assertValidGainValue(initialValue, this.options);
    return new ToneGainPluginRuntime({
      instanceId: request.instanceId,
      options: this.options,
      initialValue,
    });
  }
}

interface ToneGainPluginRuntimeOptions {
  readonly instanceId: string;
  readonly options: ToneGainPluginRuntimeFactoryOptions;
  readonly initialValue: number;
}

class ToneGainPluginRuntime implements IAudioPluginRuntime {
  readonly inputNode: Tone.Gain;
  readonly instanceId: string;
  readonly manifestId: string;
  private readonly options: ToneGainPluginRuntimeFactoryOptions;
  private baseValue: number;

  constructor({ instanceId, options, initialValue }: ToneGainPluginRuntimeOptions) {
    this.instanceId = instanceId;
    this.manifestId = options.manifestId;
    this.options = options;
    this.baseValue = initialValue;
    this.inputNode = new Tone.Gain({ gain: initialValue });
  }

  connect(destination: Tone.ToneAudioNode): void {
    this.inputNode.connect(destination);
  }

  disconnect(): void {
    this.inputNode.disconnect();
  }

  dispose(): void {
    this.inputNode.dispose();
  }

  setParameter(parameterId: string, value: PluginParameterValue): void {
    if (parameterId !== this.options.parameterId) {
      throw createParameterNotFoundError(parameterId, this.options.manifestId);
    }
    assertValidGainValue(value, this.options);
    this.baseValue = value;
    this.inputNode.gain.rampTo(value, GAIN_RAMP_SECONDS);
  }

  getAutomationTarget(parameterId: string): IAutomationAudioTarget | null {
    if (parameterId !== this.options.parameterId) {
      return null;
    }
    return createMappedAutomationTarget({
      baseValue: () => this.baseValue,
      mapValue: normalizedValue =>
        this.options.minValue + normalizedValue * (this.options.maxValue - this.options.minValue),
      parameter: this.inputNode.gain,
    });
  }
}

function assertValidFactoryOptions(options: ToneGainPluginRuntimeFactoryOptions): void {
  const hasValidIds = options.manifestId.length > 0 && options.parameterId.length > 0;
  const hasFiniteRange = Number.isFinite(options.minValue) && Number.isFinite(options.maxValue);
  const hasOrderedRange = options.minValue < options.maxValue;
  const hasValidDefault =
    Number.isFinite(options.defaultValue) &&
    options.defaultValue >= options.minValue &&
    options.defaultValue <= options.maxValue;
  if (hasValidIds && hasFiniteRange && hasOrderedRange && hasValidDefault) {
    return;
  }

  throw new AudioPluginRuntimeError({
    code: AudioPluginRuntimeErrorCode.INVALID_FACTORY_CONFIG,
    message: 'Gain Plugin runtime factory configuration is invalid',
    details: { ...options },
  });
}

function assertKnownParameters(
  parameterValues: ReadonlyMap<string, PluginParameterValue>,
  options: ToneGainPluginRuntimeFactoryOptions
): void {
  const unknownParameterId = [...parameterValues.keys()].find(parameterId => parameterId !== options.parameterId);
  if (!unknownParameterId) {
    return;
  }
  throw createParameterNotFoundError(unknownParameterId, options.manifestId);
}

function assertValidGainValue(
  value: PluginParameterValue,
  options: ToneGainPluginRuntimeFactoryOptions
): asserts value is number {
  const isValid =
    typeof value === 'number' && Number.isFinite(value) && value >= options.minValue && value <= options.maxValue;
  if (isValid) {
    return;
  }

  throw new AudioPluginRuntimeError({
    code: AudioPluginRuntimeErrorCode.INVALID_PARAMETER_VALUE,
    message: `Gain Plugin parameter value is invalid: ${options.parameterId}`,
    details: {
      manifestId: options.manifestId,
      parameterId: options.parameterId,
      value,
    },
  });
}

function createParameterNotFoundError(parameterId: string, manifestId: string): AudioPluginRuntimeError {
  return new AudioPluginRuntimeError({
    code: AudioPluginRuntimeErrorCode.PARAMETER_NOT_FOUND,
    message: `Plugin parameter was not found: ${parameterId}`,
    details: { manifestId, parameterId },
  });
}
