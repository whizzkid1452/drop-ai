import { PLUGIN_MANIFEST_SCHEMA_VERSION } from '../../../plugin-sdk/plugin-manifest.schema';

export const saturationPluginManifest = {
  schemaVersion: PLUGIN_MANIFEST_SCHEMA_VERSION,
  id: 'builtin.saturation',
  name: 'Saturation',
  version: '1.0.0',
  type: 'effect',
  parameters: [
    {
      id: 'drive',
      name: 'Drive',
      type: 'number',
      minValue: 0,
      maxValue: 1,
      defaultValue: 0.2,
      step: 0.01,
    },
  ],
  dsp: {
    workletModulePath: './saturation.worklet.js',
    processorName: 'drop-ai-saturation',
  },
  ui: {
    controls: [{ type: 'slider', parameterId: 'drive' }],
  },
} as const;
