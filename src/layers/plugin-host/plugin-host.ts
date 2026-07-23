import {
  validatePluginManifest,
  type PluginManifest,
  type PluginParameterManifest,
} from '../plugin-sdk/plugin-manifest.schema';
import { PluginHostError, PluginHostErrorCode } from './errors';
import type { IPluginHost } from './i-plugin-host';

export class PluginHost implements IPluginHost {
  private readonly manifests = new Map<string, PluginManifest>();

  registerManifest(input: unknown): PluginManifest {
    const validation = validatePluginManifest(input);
    if (validation.status === 'invalid') {
      throw new PluginHostError({
        code: PluginHostErrorCode.INVALID_MANIFEST,
        message: 'Plugin manifest validation failed',
        issues: validation.issues,
      });
    }

    const manifest = validation.manifest;
    if (this.manifests.has(manifest.id)) {
      throw new PluginHostError({
        code: PluginHostErrorCode.MANIFEST_ALREADY_REGISTERED,
        message: `Plugin manifest is already registered: ${manifest.id}`,
        manifestId: manifest.id,
      });
    }

    this.manifests.set(manifest.id, manifest);
    return clonePluginManifest(manifest);
  }

  resolveManifest(manifestId: string): PluginManifest | null {
    const manifest = this.manifests.get(manifestId);
    return manifest ? clonePluginManifest(manifest) : null;
  }

  listManifests(): PluginManifest[] {
    return [...this.manifests.values()].map(clonePluginManifest);
  }
}

function clonePluginManifest(manifest: PluginManifest): PluginManifest {
  return {
    ...manifest,
    parameters: manifest.parameters.map(clonePluginParameter),
    dsp: { ...manifest.dsp },
    ui: {
      controls: manifest.ui.controls.map(control => ({ ...control })),
    },
  };
}

function clonePluginParameter(parameter: PluginParameterManifest): PluginParameterManifest {
  if (parameter.type === 'enum') {
    return {
      ...parameter,
      options: parameter.options.map(option => ({ ...option })),
    };
  }

  return { ...parameter };
}
