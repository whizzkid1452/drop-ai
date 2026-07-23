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
  readonly parameterValues: Readonly<Record<string, PluginParameterValue>>;
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

    const manifest = this.getManifestOrThrow(request.manifestId);
    const parameters = this.createParameterStates({ manifest, parameterValues: request.parameterValues });
    const isEnabled = request.isEnabled ?? true;
    const instance: PluginInstanceState = {
      id: request.instanceId,
      manifestSummary: createPluginManifestSummary(manifest),
      isEnabled,
      parameters,
    };
    this.audioEngine.installPlugin({
      trackId: request.trackId,
      instanceId: request.instanceId,
      manifestId: request.manifestId,
      isEnabled,
      parameterValues: new Map(parameters.map(parameter => [parameter.id, parameter.value])),
    });
    this.sessionStore.getState().addPluginInstance({ trackId: request.trackId, instance });
  }

  removePlugin(request: RemovePluginRequest): void {
    this.getPluginInstanceOrThrow(request);
    this.audioEngine.removePlugin(request.trackId, request.instanceId);
    this.sessionStore.getState().removePluginInstance(request);
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
