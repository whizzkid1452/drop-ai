import { PLUGIN_MANIFEST_SCHEMA_VERSION } from '../../../plugin-sdk/plugin-manifest.schema';

export const gainPluginManifest = {
  schemaVersion: PLUGIN_MANIFEST_SCHEMA_VERSION,
  id: 'builtin.gain',
  name: 'Gain',
  version: '1.0.0',
  type: 'effect',
  parameters: [
    {
      id: 'gain',
      name: 'Gain',
      type: 'number',
      minValue: 0,
      maxValue: 2,
      defaultValue: 1,
      step: 0.01,
    },
  ],
  dsp: {
    workletModulePath: './gain.worklet.js',
    processorName: 'drop-ai-gain',
  },
  ui: {
    controls: [{ type: 'slider', parameterId: 'gain' }],
  },
} as const;
