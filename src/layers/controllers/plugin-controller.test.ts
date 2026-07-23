import { describe, expect, it } from 'vitest';
import { PluginHost } from '../plugin-host/plugin-host';
import { PluginController } from './plugin-controller';

const gainManifest = {
  schemaVersion: 1,
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
};

describe('PluginController', () => {
  it('주입받은 PluginHost에서 전체 manifest를 조회한다', () => {
    const pluginHost = new PluginHost();
    pluginHost.registerManifest(gainManifest);
    const controller = new PluginController(pluginHost);

    expect(controller.resolveManifest('builtin.gain')).toMatchObject({
      id: 'builtin.gain',
      dsp: { processorName: 'drop-ai-gain' },
    });
  });

  it('등록되지 않은 Plugin ID 조회는 null을 반환한다', () => {
    const controller = new PluginController(new PluginHost());

    expect(controller.resolveManifest('builtin.missing')).toBeNull();
  });
});
