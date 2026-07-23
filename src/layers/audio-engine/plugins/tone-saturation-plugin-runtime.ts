import * as Tone from 'tone';
import type { PluginParameterValue } from '../../shared/types/plugin-state';
import type {
  CreateAudioPluginRuntimeRequest,
  IAudioPluginRuntime,
  IAudioPluginRuntimeFactory,
} from './audio-plugin-runtime';
import { AudioPluginRuntimeError, AudioPluginRuntimeErrorCode } from './errors';

const SATURATION_OVERSAMPLE = '2x';

export interface ToneSaturationPluginRuntimeFactoryOptions {
  readonly manifestId: string;
  readonly parameterId: string;
  readonly minValue: number;
  readonly maxValue: number;
  readonly defaultValue: number;
}

export class ToneSaturationPluginRuntimeFactory implements IAudioPluginRuntimeFactory {
  readonly manifestId: string;
  private readonly options: ToneSaturationPluginRuntimeFactoryOptions;

  constructor(options: ToneSaturationPluginRuntimeFactoryOptions) {
    assertValidFactoryOptions(options);
    this.manifestId = options.manifestId;
    this.options = { ...options };
  }

  create(request: CreateAudioPluginRuntimeRequest): IAudioPluginRuntime {
    assertKnownParameters(request.parameterValues, this.options);
    const initialValue = request.parameterValues.get(this.options.parameterId) ?? this.options.defaultValue;
    assertValidDriveValue(initialValue, this.options);
    return new ToneSaturationPluginRuntime({
      instanceId: request.instanceId,
      options: this.options,
      initialValue,
    });
  }
}

interface ToneSaturationPluginRuntimeOptions {
  readonly instanceId: string;
  readonly options: ToneSaturationPluginRuntimeFactoryOptions;
  readonly initialValue: number;
}

class ToneSaturationPluginRuntime implements IAudioPluginRuntime {
  readonly inputNode: Tone.Distortion;
  readonly instanceId: string;
  readonly manifestId: string;
  private readonly options: ToneSaturationPluginRuntimeFactoryOptions;

  constructor({ instanceId, options, initialValue }: ToneSaturationPluginRuntimeOptions) {
    this.instanceId = instanceId;
    this.manifestId = options.manifestId;
    this.options = options;
    this.inputNode = new Tone.Distortion({ distortion: initialValue, oversample: SATURATION_OVERSAMPLE });
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
    assertValidDriveValue(value, this.options);
    this.inputNode.distortion = value;
  }
}

function assertValidFactoryOptions(options: ToneSaturationPluginRuntimeFactoryOptions): void {
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
    message: 'Saturation Plugin runtime factory configuration is invalid',
    details: { ...options },
  });
}

function assertKnownParameters(
  parameterValues: ReadonlyMap<string, PluginParameterValue>,
  options: ToneSaturationPluginRuntimeFactoryOptions
): void {
  const unknownParameterId = [...parameterValues.keys()].find(parameterId => parameterId !== options.parameterId);
  if (!unknownParameterId) {
    return;
  }
  throw createParameterNotFoundError(unknownParameterId, options.manifestId);
}

function assertValidDriveValue(
  value: PluginParameterValue,
  options: ToneSaturationPluginRuntimeFactoryOptions
): asserts value is number {
  const isValid =
    typeof value === 'number' && Number.isFinite(value) && value >= options.minValue && value <= options.maxValue;
  if (isValid) {
    return;
  }

  throw new AudioPluginRuntimeError({
    code: AudioPluginRuntimeErrorCode.INVALID_PARAMETER_VALUE,
    message: `Saturation Plugin parameter value is invalid: ${options.parameterId}`,
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
