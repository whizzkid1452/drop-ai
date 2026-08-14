import { PLUGIN_MANIFEST_SCHEMA_VERSION } from '../../../plugin-sdk/plugin-manifest.schema';

export const saturationPluginManifest = {
  schemaVersion: PLUGIN_MANIFEST_SCHEMA_VERSION,
  id: 'builtin.saturation',
  name: 'Saturation',
  category: 'distortion',
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
  presets: [
    { id: 'subtle', name: 'Subtle', parameterValues: { drive: 0.15 } },
    { id: 'warm', name: 'Warm', parameterValues: { drive: 0.4 } },
    { id: 'heavy', name: 'Heavy', parameterValues: { drive: 0.8 } },
  ],
  supportsSidechain: false,
  dsp: {
    workletModulePath: './saturation.worklet.js',
    processorName: 'drop-ai-saturation',
  },
  ui: {
    controls: [{ type: 'slider', parameterId: 'drive' }],
  },
} as const;
