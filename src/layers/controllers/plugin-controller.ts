import type { IPluginHost } from '../plugin-host/i-plugin-host';
import type { PluginManifest } from '../plugin-sdk/plugin-manifest.schema';

export class PluginController {
  constructor(private readonly pluginHost: IPluginHost) {}

  resolveManifest(manifestId: string): PluginManifest | null {
    return this.pluginHost.resolveManifest(manifestId);
  }
}
