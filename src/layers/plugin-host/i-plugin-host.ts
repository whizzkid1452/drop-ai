import type { PluginManifest } from '../plugin-sdk/plugin-manifest.schema';

export interface IPluginHost {
  registerManifest(input: unknown): PluginManifest;
  resolveManifest(manifestId: string): PluginManifest | null;
  listManifests(): PluginManifest[];
}
