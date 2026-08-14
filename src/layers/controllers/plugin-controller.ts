import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import type { IPluginHost } from '../plugin-host/i-plugin-host';
import {
  createPluginManifestSummary,
  type PluginManifest,
  type PluginParameterManifest,
} from '../plugin-sdk/plugin-manifest.schema';
import type { SessionStore, TrackState } from '../session/session';
import { isPluginParameterValueCompatible } from '../shared/project-plugin-compatibility';
import type { PluginInstanceState, PluginParameterState, PluginParameterValue } from '../shared/types/plugin-state';
import { ProjectStateError, ProjectStateErrorCode } from './project-state-error';

interface PluginControllerDependencies {
  readonly pluginHost: IPluginHost;
  readonly sessionStore: SessionStore;
  readonly audioEngine: IAudioEngine;
}

export interface InstallPluginRequest {
  readonly trackId: string;
  readonly instanceId: string;
  readonly manifestId: string;
  readonly isEnabled?: boolean;
  readonly targetIndex?: number;
  readonly parameterValues: Readonly<Record<string, PluginParameterValue>>;
  readonly presetId?: string | null;
  readonly sidechainSourceTrackId?: string | null;
  readonly stateBlob?: string | null;
}

export interface RemovePluginRequest {
  readonly trackId: string;
  readonly instanceId: string;
}

export interface SetPluginParameterRequest extends RemovePluginRequest {
  readonly parameterId: string;
  readonly value: PluginParameterValue;
}

export interface SetPluginEnabledRequest extends RemovePluginRequest {
  readonly isEnabled: boolean;
}

export interface MovePluginRequest extends RemovePluginRequest {
  readonly targetIndex: number;
}

export interface ApplyPluginPresetRequest extends RemovePluginRequest {
  readonly presetId: string;
}

export interface SetPluginSidechainRequest extends RemovePluginRequest {
  readonly sourceTrackId: string | null;
}

export interface RestorePluginStateRequest extends RemovePluginRequest {
  readonly parameterValues: Readonly<Record<string, PluginParameterValue>>;
  readonly presetId: string | null;
  readonly sidechainSourceTrackId: string | null;
  readonly stateBlob: string | null;
}

interface ValidatePluginTargetIndexRequest extends MovePluginRequest {
  readonly maximumIndex: number;
}

interface CreateParameterStatesRequest {
  readonly manifest: PluginManifest;
  readonly parameterValues: Readonly<Record<string, PluginParameterValue>>;
}

interface ValidateParameterValueRequest {
  readonly manifestId: string;
  readonly parameter: PluginParameterManifest;
  readonly value: PluginParameterValue;
}

export class PluginController {
  private readonly pluginHost: IPluginHost;
  private readonly sessionStore: SessionStore;
  private readonly audioEngine: IAudioEngine;

  constructor({ pluginHost, sessionStore, audioEngine }: PluginControllerDependencies) {
    this.pluginHost = pluginHost;
    this.sessionStore = sessionStore;
    this.audioEngine = audioEngine;
  }

  resolveManifest(manifestId: string): PluginManifest | null {
    return this.pluginHost.resolveManifest(manifestId);
  }

  installPlugin(request: InstallPluginRequest): void {
    const track = this.getTrackOrThrow(request.trackId);
    if (track.pluginInstances.some(instance => instance.id === request.instanceId)) {
      throw new ProjectStateError(
        ProjectStateErrorCode.PLUGIN_INSTANCE_ID_CONFLICT,
        `이미 사용 중인 Plugin instance ID입니다: ${request.instanceId}`,
        { instanceId: request.instanceId, trackId: request.trackId }
      );
    }

    const targetIndex = request.targetIndex ?? track.pluginInstances.length;
    this.validatePluginTargetIndex({ ...request, targetIndex, maximumIndex: track.pluginInstances.length });

    const manifest = this.getManifestOrThrow(request.manifestId);
    if (request.presetId && !manifest.presets?.some(preset => preset.id === request.presetId)) {
      throw new ProjectStateError(
        ProjectStateErrorCode.PLUGIN_PRESET_NOT_FOUND,
        `Plugin Preset을 찾을 수 없습니다: ${request.presetId}`,
        { manifestId: manifest.id, presetId: request.presetId }
      );
    }
    if (request.sidechainSourceTrackId) {
      if (manifest.supportsSidechain !== true || request.sidechainSourceTrackId === request.trackId) {
        throw new ProjectStateError(
          ProjectStateErrorCode.PLUGIN_SIDECHAIN_NOT_SUPPORTED,
          `Plugin sidechain 설정을 적용할 수 없습니다: ${manifest.id}`,
          { sourceTrackId: request.sidechainSourceTrackId, trackId: request.trackId }
        );
      }
      this.getTrackOrThrow(request.sidechainSourceTrackId);
    }
    const parameters = this.createParameterStates({ manifest, parameterValues: request.parameterValues });
    const isEnabled = request.isEnabled ?? true;
    const instance: PluginInstanceState = {
      availability: 'available',
      id: request.instanceId,
      manifestSummary: createPluginManifestSummary(manifest),
      isEnabled,
      parameters,
      presetId: request.presetId ?? null,
      sidechainSourceTrackId: request.sidechainSourceTrackId ?? null,
      stateBlob: request.stateBlob ?? null,
    };
    this.audioEngine.installPlugin({
      trackId: request.trackId,
      instanceId: request.instanceId,
      manifestId: request.manifestId,
      isEnabled,
      targetIndex,
      parameterValues: new Map(parameters.map(parameter => [parameter.id, parameter.value])),
      sidechainSourceTrackId: request.sidechainSourceTrackId ?? null,
      stateBlob: request.stateBlob ?? null,
    });
    this.sessionStore.getState().addPluginInstance({ trackId: request.trackId, instance, targetIndex });
  }

  removePlugin(request: RemovePluginRequest): void {
    const track = this.getTrackOrThrow(request.trackId);
    this.getPluginInstanceOrThrow(request);
    const targetLane = track.automationLanes?.find(
      lane => lane.target.kind === 'pluginParameter' && lane.target.pluginInstanceId === request.instanceId
    );
    if (targetLane) {
      throw new ProjectStateError(
        ProjectStateErrorCode.AUTOMATION_TARGET_IN_USE,
        `Plugin을 대상으로 하는 Automation lane이 남아 있습니다: ${request.instanceId}`,
        { automationLaneId: targetLane.id, instanceId: request.instanceId, trackId: request.trackId }
      );
    }
    this.audioEngine.removePlugin(request.trackId, request.instanceId);
    this.sessionStore.getState().removePluginInstance(request);
  }

  movePlugin(request: MovePluginRequest): void {
    const track = this.getTrackOrThrow(request.trackId);
    const currentIndex = track.pluginInstances.findIndex(instance => instance.id === request.instanceId);
    if (currentIndex < 0) {
      throw new ProjectStateError(
        ProjectStateErrorCode.PLUGIN_INSTANCE_NOT_FOUND,
        `Plugin instance를 찾을 수 없습니다: ${request.instanceId}`,
        { instanceId: request.instanceId, trackId: request.trackId }
      );
    }
    this.validatePluginTargetIndex({ ...request, maximumIndex: track.pluginInstances.length - 1 });
    if (currentIndex === request.targetIndex) {
      return;
    }
    this.audioEngine.movePlugin(request);
    this.sessionStore.getState().movePluginInstance(request);
  }

  setPluginParameter(request: SetPluginParameterRequest): void {
    const instance = this.getPluginInstanceOrThrow(request);
    const manifest = this.getManifestOrThrow(instance.manifestSummary.id);
    const parameter = manifest.parameters.find(candidate => candidate.id === request.parameterId);
    if (!parameter) {
      throw new ProjectStateError(
        ProjectStateErrorCode.PLUGIN_PARAMETER_NOT_FOUND,
        `Plugin Parameter를 찾을 수 없습니다: ${request.parameterId}`,
        { instanceId: request.instanceId, parameterId: request.parameterId, trackId: request.trackId }
      );
    }
    this.validateParameterValue({ manifestId: manifest.id, parameter, value: request.value });
    this.audioEngine.setPluginParameter(request);
    this.sessionStore.getState().setPluginParameterValue(request);
  }

  setPluginEnabled(request: SetPluginEnabledRequest): void {
    const instance = this.getPluginInstanceOrThrow(request);
    if (instance.isEnabled === request.isEnabled) {
      return;
    }
    this.audioEngine.setPluginEnabled(request);
    this.sessionStore.getState().setPluginInstanceEnabled(request);
  }

  applyPluginPreset(request: ApplyPluginPresetRequest): void {
    const instance = this.getPluginInstanceOrThrow(request);
    const manifest = this.getManifestOrThrow(instance.manifestSummary.id);
    const preset = manifest.presets?.find(candidate => candidate.id === request.presetId);
    if (!preset) {
      throw new ProjectStateError(
        ProjectStateErrorCode.PLUGIN_PRESET_NOT_FOUND,
        `Plugin Preset을 찾을 수 없습니다: ${request.presetId}`,
        { instanceId: request.instanceId, presetId: request.presetId, trackId: request.trackId }
      );
    }
    const parameterValues = Object.fromEntries(instance.parameters.map(parameter => [parameter.id, parameter.value]));
    this.restorePluginState({
      ...request,
      parameterValues: { ...parameterValues, ...preset.parameterValues },
      presetId: preset.id,
      sidechainSourceTrackId: instance.sidechainSourceTrackId ?? null,
      stateBlob: instance.stateBlob ?? null,
    });
  }

  setPluginSidechain(request: SetPluginSidechainRequest): void {
    const instance = this.getPluginInstanceOrThrow(request);
    const manifest = this.getManifestOrThrow(instance.manifestSummary.id);
    if (manifest.supportsSidechain !== true) {
      throw new ProjectStateError(
        ProjectStateErrorCode.PLUGIN_SIDECHAIN_NOT_SUPPORTED,
        `Plugin이 sidechain 입력을 지원하지 않습니다: ${manifest.id}`,
        { instanceId: request.instanceId, sourceTrackId: request.sourceTrackId, trackId: request.trackId }
      );
    }
    if (request.sourceTrackId !== null) {
      this.getTrackOrThrow(request.sourceTrackId);
    }
    if (request.sourceTrackId === request.trackId) {
      throw new ProjectStateError(
        ProjectStateErrorCode.PLUGIN_SIDECHAIN_NOT_SUPPORTED,
        'Sidechain source는 대상 Track과 달라야 합니다.',
        { instanceId: request.instanceId, sourceTrackId: request.sourceTrackId, trackId: request.trackId }
      );
    }
    this.restorePluginState({
      ...request,
      parameterValues: Object.fromEntries(instance.parameters.map(parameter => [parameter.id, parameter.value])),
      presetId: instance.presetId ?? null,
      sidechainSourceTrackId: request.sourceTrackId,
      stateBlob: instance.stateBlob ?? null,
    });
  }

  restorePluginState(request: RestorePluginStateRequest): void {
    const instance = this.getPluginInstanceOrThrow(request);
    const manifest = this.getManifestOrThrow(instance.manifestSummary.id);
    const parameters = this.createParameterStates({ manifest, parameterValues: request.parameterValues });
    const previousValues = new Map(instance.parameters.map(parameter => [parameter.id, parameter.value]));
    const changedParameters = parameters.filter(parameter => previousValues.get(parameter.id) !== parameter.value);
    const appliedParameters: PluginParameterState[] = [];
    let sidechainChanged = false;

    try {
      changedParameters.forEach(parameter => {
        this.audioEngine.setPluginParameter({
          trackId: request.trackId,
          instanceId: request.instanceId,
          parameterId: parameter.id,
          value: parameter.value,
        });
        appliedParameters.push(parameter);
      });
      if ((instance.sidechainSourceTrackId ?? null) !== request.sidechainSourceTrackId) {
        this.audioEngine.setPluginSidechain({
          trackId: request.trackId,
          instanceId: request.instanceId,
          sourceTrackId: request.sidechainSourceTrackId,
        });
        sidechainChanged = true;
      }
    } catch (cause) {
      if (sidechainChanged) {
        this.audioEngine.setPluginSidechain({
          trackId: request.trackId,
          instanceId: request.instanceId,
          sourceTrackId: instance.sidechainSourceTrackId ?? null,
        });
      }
      appliedParameters.reverse().forEach(parameter => {
        const value = previousValues.get(parameter.id);
        if (value !== undefined) {
          this.audioEngine.setPluginParameter({
            trackId: request.trackId,
            instanceId: request.instanceId,
            parameterId: parameter.id,
            value,
          });
        }
      });
      throw cause;
    }

    this.sessionStore.getState().setPluginInstanceState({
      trackId: request.trackId,
      instanceId: request.instanceId,
      parameters,
      presetId: request.presetId,
      sidechainSourceTrackId: request.sidechainSourceTrackId,
      stateBlob: request.stateBlob,
    });
  }

  setPluginFavorite(manifestId: string, isFavorite: boolean): void {
    if (!this.sessionStore.getState().pluginCatalog.has(manifestId)) {
      throw new ProjectStateError(
        ProjectStateErrorCode.PLUGIN_MANIFEST_NOT_FOUND,
        `사용 가능한 Plugin manifest를 찾을 수 없습니다: ${manifestId}`,
        { manifestId }
      );
    }
    this.sessionStore.getState().setPluginFavorite(manifestId, isFavorite);
  }

  private createParameterStates({ manifest, parameterValues }: CreateParameterStatesRequest): PluginParameterState[] {
    const parametersById = new Map(manifest.parameters.map(parameter => [parameter.id, parameter]));
    const unknownParameterId = Object.keys(parameterValues).find(parameterId => !parametersById.has(parameterId));
    if (unknownParameterId) {
      throw new ProjectStateError(
        ProjectStateErrorCode.PLUGIN_PARAMETER_NOT_FOUND,
        `Plugin Parameter를 찾을 수 없습니다: ${unknownParameterId}`,
        { manifestId: manifest.id, parameterId: unknownParameterId }
      );
    }

    return manifest.parameters.map(parameter => {
      const value = Object.hasOwn(parameterValues, parameter.id)
        ? parameterValues[parameter.id]
        : parameter.defaultValue;
      this.validateParameterValue({ manifestId: manifest.id, parameter, value });
      return { id: parameter.id, value };
    });
  }

  private validateParameterValue({ manifestId, parameter, value }: ValidateParameterValueRequest): void {
    if (isPluginParameterValueCompatible(parameter, value)) {
      return;
    }

    throw new ProjectStateError(
      ProjectStateErrorCode.INVALID_PLUGIN_PARAMETER_VALUE,
      `Plugin Parameter 값이 유효하지 않습니다: ${parameter.id}`,
      { manifestId, parameterId: parameter.id, value }
    );
  }

  private validatePluginTargetIndex({
    trackId,
    instanceId,
    targetIndex,
    maximumIndex,
  }: ValidatePluginTargetIndexRequest): void {
    if (Number.isInteger(targetIndex) && targetIndex >= 0 && targetIndex <= maximumIndex) {
      return;
    }
    throw new ProjectStateError(
      ProjectStateErrorCode.PLUGIN_TARGET_INDEX_OUT_OF_RANGE,
      `Plugin 대상 index가 범위를 벗어났습니다: ${targetIndex}`,
      { instanceId, maximumIndex, targetIndex, trackId }
    );
  }

  private getTrackOrThrow(trackId: string): TrackState {
    const track = this.sessionStore.getState().tracks.get(trackId);
    if (track) {
      return track;
    }
    throw new ProjectStateError(ProjectStateErrorCode.TRACK_NOT_FOUND, `트랙을 찾을 수 없습니다: ${trackId}`, {
      trackId,
    });
  }

  private getPluginInstanceOrThrow(request: RemovePluginRequest): PluginInstanceState {
    const instance = this.getTrackOrThrow(request.trackId).pluginInstances.find(
      candidate => candidate.id === request.instanceId
    );
    if (instance) {
      return instance;
    }
    throw new ProjectStateError(
      ProjectStateErrorCode.PLUGIN_INSTANCE_NOT_FOUND,
      `Plugin instance를 찾을 수 없습니다: ${request.instanceId}`,
      { instanceId: request.instanceId, trackId: request.trackId }
    );
  }

  private getManifestOrThrow(manifestId: string): PluginManifest {
    const manifest = this.pluginHost.resolveManifest(manifestId);
    if (manifest) {
      return manifest;
    }
    throw new ProjectStateError(
      ProjectStateErrorCode.PLUGIN_MANIFEST_NOT_FOUND,
      `Plugin manifest를 찾을 수 없습니다: ${manifestId}`,
      { manifestId }
    );
  }
}
