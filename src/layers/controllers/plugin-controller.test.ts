import { describe, expect, it, vi } from 'vitest';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
import { PluginHost } from '../plugin-host/plugin-host';
import { createSessionStore } from '../session/session';
import { ProjectStateErrorCode } from './project-state-error';
import { PluginController } from './plugin-controller';

const gainManifest = {
  schemaVersion: 1,
  id: 'builtin.gain',
  name: 'Gain',
  version: '1.0.0',
  type: 'effect',
  category: 'utility',
  supportsSidechain: true,
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
  presets: [{ id: 'half', name: 'Half', parameterValues: { gain: 0.5 } }],
  dsp: {
    workletModulePath: './gain.worklet.js',
    processorName: 'drop-ai-gain',
  },
  ui: {
    controls: [{ type: 'slider', parameterId: 'gain' }],
  },
} as const;

function createTestContext() {
  const pluginHost = new PluginHost();
  pluginHost.registerManifest(gainManifest);
  const sessionStore = createSessionStore({
    initialProjectMetadata: {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Plugin 테스트',
      revision: 0,
    },
  });
  sessionStore.getState().addTrack({
    id: 'track-1',
    name: 'Track 1',
    volume: 1,
    pan: 0,
    isMuted: false,
    isSoloed: false,
    status: [],
    pluginInstances: [],
    regions: [],
  });
  sessionStore.getState().addTrack({
    id: 'track-2',
    name: 'Track 2',
    volume: 1,
    pan: 0,
    isMuted: false,
    isSoloed: false,
    status: [],
    pluginInstances: [],
    regions: [],
  });
  sessionStore.getState().replacePluginCatalogState({
    manifests: [
      {
        id: gainManifest.id,
        name: gainManifest.name,
        version: gainManifest.version,
        parameters: gainManifest.parameters,
        presets: gainManifest.presets,
        supportsSidechain: true,
      },
    ],
    validationResults: [],
  });
  const audioEngine = new MockAudioEngine();
  void audioEngine.addTrack('track-1');
  void audioEngine.addTrack('track-2');
  const controller = new PluginController({ pluginHost, sessionStore, audioEngine });
  return { audioEngine, controller, pluginHost, sessionStore };
}

describe('PluginController', () => {
  it('Preset을 runtime과 Session에 한 번에 적용한다', () => {
    const { audioEngine, controller, sessionStore } = createTestContext();
    controller.installPlugin({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      manifestId: 'builtin.gain',
      parameterValues: {},
    });
    const setPluginParameter = vi.spyOn(audioEngine, 'setPluginParameter');

    controller.applyPluginPreset({ trackId: 'track-1', instanceId: 'plugin-1', presetId: 'half' });

    expect(setPluginParameter).toHaveBeenCalledWith({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      parameterId: 'gain',
      value: 0.5,
    });
    expect(sessionStore.getState().tracks.get('track-1')?.pluginInstances[0]).toMatchObject({
      parameters: [{ id: 'gain', value: 0.5 }],
      presetId: 'half',
    });
  });

  it('Sidechain source를 runtime 성공 뒤 Session에 반영한다', () => {
    const { audioEngine, controller, sessionStore } = createTestContext();
    controller.installPlugin({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      manifestId: 'builtin.gain',
      parameterValues: {},
    });
    const setPluginSidechain = vi.spyOn(audioEngine, 'setPluginSidechain');

    controller.setPluginSidechain({ trackId: 'track-1', instanceId: 'plugin-1', sourceTrackId: 'track-2' });

    expect(setPluginSidechain).toHaveBeenCalledWith({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      sourceTrackId: 'track-2',
    });
    expect(sessionStore.getState().tracks.get('track-1')?.pluginInstances[0]?.sidechainSourceTrackId).toBe('track-2');
  });

  it('Favorite은 프로젝트 Plugin instance와 분리된 runtime 상태로 관리한다', () => {
    const { controller, sessionStore } = createTestContext();

    controller.setPluginFavorite('builtin.gain', true);
    expect(sessionStore.getState().favoritePluginManifestIds).toEqual(new Set(['builtin.gain']));

    controller.setPluginFavorite('builtin.gain', false);
    expect(sessionStore.getState().favoritePluginManifestIds).toEqual(new Set());
  });

  it('주입받은 PluginHost에서 전체 manifest를 조회한다', () => {
    const { controller } = createTestContext();

    expect(controller.resolveManifest('builtin.gain')).toMatchObject({
      id: 'builtin.gain',
      dsp: { processorName: 'drop-ai-gain' },
    });
  });

  it('등록되지 않은 Plugin ID 조회는 null을 반환한다', () => {
    const { audioEngine, sessionStore } = createTestContext();
    const controller = new PluginController({ pluginHost: new PluginHost(), sessionStore, audioEngine });

    expect(controller.resolveManifest('builtin.missing')).toBeNull();
  });

  it('manifest 기본값으로 Plugin을 AudioEngine에 설치한 뒤 Session에 추가한다', () => {
    const { audioEngine, controller, sessionStore } = createTestContext();
    const installPlugin = vi.spyOn(audioEngine, 'installPlugin');

    controller.installPlugin({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      manifestId: 'builtin.gain',
      parameterValues: {},
    });

    expect(installPlugin).toHaveBeenCalledWith({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      manifestId: 'builtin.gain',
      isEnabled: true,
      targetIndex: 0,
      parameterValues: new Map([['gain', 1]]),
      sidechainSourceTrackId: null,
      stateBlob: null,
    });
    expect(sessionStore.getState().tracks.get('track-1')?.pluginInstances).toEqual([
      {
        availability: 'available',
        id: 'plugin-1',
        manifestSummary: { id: 'builtin.gain', name: 'Gain', version: '1.0.0' },
        isEnabled: true,
        parameters: [{ id: 'gain', value: 1 }],
        presetId: null,
        sidechainSourceTrackId: null,
        stateBlob: null,
      },
    ]);
  });

  it('비활성화된 Plugin을 AudioEngine과 Session에 같은 상태로 설치한다', () => {
    const { audioEngine, controller, sessionStore } = createTestContext();
    const installPlugin = vi.spyOn(audioEngine, 'installPlugin');

    controller.installPlugin({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      manifestId: 'builtin.gain',
      isEnabled: false,
      parameterValues: {},
    });

    expect(installPlugin).toHaveBeenCalledWith(expect.objectContaining({ instanceId: 'plugin-1', isEnabled: false }));
    expect(sessionStore.getState().tracks.get('track-1')?.pluginInstances[0]?.isEnabled).toBe(false);
  });

  it('Plugin을 지정한 index에 설치한다', () => {
    const { audioEngine, controller, sessionStore } = createTestContext();
    controller.installPlugin({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      manifestId: 'builtin.gain',
      parameterValues: {},
    });
    const installPlugin = vi.spyOn(audioEngine, 'installPlugin');

    controller.installPlugin({
      trackId: 'track-1',
      instanceId: 'plugin-2',
      manifestId: 'builtin.gain',
      targetIndex: 0,
      parameterValues: {},
    });

    expect(installPlugin).toHaveBeenCalledWith(expect.objectContaining({ instanceId: 'plugin-2', targetIndex: 0 }));
    expect(
      sessionStore
        .getState()
        .tracks.get('track-1')
        ?.pluginInstances.map(instance => instance.id)
    ).toEqual(['plugin-2', 'plugin-1']);
  });

  it('Plugin 설치 index가 범위를 벗어나면 AudioEngine 호출 전에 거부한다', () => {
    const { audioEngine, controller } = createTestContext();
    const installPlugin = vi.spyOn(audioEngine, 'installPlugin');

    expect(() =>
      controller.installPlugin({
        trackId: 'track-1',
        instanceId: 'plugin-1',
        manifestId: 'builtin.gain',
        targetIndex: 1,
        parameterValues: {},
      })
    ).toThrowError(expect.objectContaining({ code: ProjectStateErrorCode.PLUGIN_TARGET_INDEX_OUT_OF_RANGE }));
    expect(installPlugin).not.toHaveBeenCalled();
  });

  it('AudioEngine 설치가 실패하면 Session에 Plugin을 추가하지 않는다', () => {
    const { audioEngine, controller, sessionStore } = createTestContext();
    vi.spyOn(audioEngine, 'installPlugin').mockImplementation(() => {
      throw new Error('install failed');
    });

    expect(() =>
      controller.installPlugin({
        trackId: 'track-1',
        instanceId: 'plugin-1',
        manifestId: 'builtin.gain',
        parameterValues: {},
      })
    ).toThrow('install failed');
    expect(sessionStore.getState().tracks.get('track-1')?.pluginInstances).toEqual([]);
  });

  it('등록되지 않은 manifest와 범위 밖 Parameter를 AudioEngine 호출 전에 거부한다', () => {
    const { audioEngine, controller } = createTestContext();
    const installPlugin = vi.spyOn(audioEngine, 'installPlugin');

    expect(() =>
      controller.installPlugin({
        trackId: 'track-1',
        instanceId: 'plugin-1',
        manifestId: 'builtin.missing',
        parameterValues: {},
      })
    ).toThrowError(expect.objectContaining({ code: ProjectStateErrorCode.PLUGIN_MANIFEST_NOT_FOUND }));
    expect(() =>
      controller.installPlugin({
        trackId: 'track-1',
        instanceId: 'plugin-1',
        manifestId: 'builtin.gain',
        parameterValues: { gain: 3 },
      })
    ).toThrowError(expect.objectContaining({ code: ProjectStateErrorCode.INVALID_PLUGIN_PARAMETER_VALUE }));
    expect(installPlugin).not.toHaveBeenCalled();
  });

  it('Plugin Parameter를 AudioEngine 성공 뒤 Session에 반영한다', () => {
    const { audioEngine, controller, sessionStore } = createTestContext();
    controller.installPlugin({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      manifestId: 'builtin.gain',
      parameterValues: {},
    });
    const setPluginParameter = vi.spyOn(audioEngine, 'setPluginParameter');

    controller.setPluginParameter({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      parameterId: 'gain',
      value: 0.5,
    });

    expect(setPluginParameter).toHaveBeenCalledWith({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      parameterId: 'gain',
      value: 0.5,
    });
    expect(sessionStore.getState().tracks.get('track-1')?.pluginInstances[0]?.parameters).toEqual([
      { id: 'gain', value: 0.5 },
    ]);
  });

  it('AudioEngine Parameter 변경이 실패하면 Session 값을 유지한다', () => {
    const { audioEngine, controller, sessionStore } = createTestContext();
    controller.installPlugin({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      manifestId: 'builtin.gain',
      parameterValues: {},
    });
    vi.spyOn(audioEngine, 'setPluginParameter').mockImplementation(() => {
      throw new Error('parameter failed');
    });

    expect(() =>
      controller.setPluginParameter({
        trackId: 'track-1',
        instanceId: 'plugin-1',
        parameterId: 'gain',
        value: 0.5,
      })
    ).toThrow('parameter failed');
    expect(sessionStore.getState().tracks.get('track-1')?.pluginInstances[0]?.parameters).toEqual([
      { id: 'gain', value: 1 },
    ]);
  });

  it('Plugin 활성화 상태를 AudioEngine 성공 후 Session에 반영한다', () => {
    const { audioEngine, controller, sessionStore } = createTestContext();
    controller.installPlugin({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      manifestId: 'builtin.gain',
      parameterValues: {},
    });
    const setPluginEnabled = vi.spyOn(audioEngine, 'setPluginEnabled');

    controller.setPluginEnabled({ trackId: 'track-1', instanceId: 'plugin-1', isEnabled: false });

    expect(setPluginEnabled).toHaveBeenCalledWith({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      isEnabled: false,
    });
    expect(sessionStore.getState().tracks.get('track-1')?.pluginInstances[0]?.isEnabled).toBe(false);
  });

  it('AudioEngine 활성화 상태 변경이 실패하면 Session 상태를 유지한다', () => {
    const { audioEngine, controller, sessionStore } = createTestContext();
    controller.installPlugin({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      manifestId: 'builtin.gain',
      parameterValues: {},
    });
    vi.spyOn(audioEngine, 'setPluginEnabled').mockImplementation(() => {
      throw new Error('enable failed');
    });

    expect(() => controller.setPluginEnabled({ trackId: 'track-1', instanceId: 'plugin-1', isEnabled: false })).toThrow(
      'enable failed'
    );
    expect(sessionStore.getState().tracks.get('track-1')?.pluginInstances[0]?.isEnabled).toBe(true);
  });

  it('중복 instance와 없는 Parameter를 AudioEngine 호출 전에 거부한다', () => {
    const { audioEngine, controller } = createTestContext();
    controller.installPlugin({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      manifestId: 'builtin.gain',
      parameterValues: {},
    });
    const installPlugin = vi.spyOn(audioEngine, 'installPlugin');
    const setPluginParameter = vi.spyOn(audioEngine, 'setPluginParameter');

    expect(() =>
      controller.installPlugin({
        trackId: 'track-1',
        instanceId: 'plugin-1',
        manifestId: 'builtin.gain',
        parameterValues: {},
      })
    ).toThrowError(expect.objectContaining({ code: ProjectStateErrorCode.PLUGIN_INSTANCE_ID_CONFLICT }));
    expect(() =>
      controller.setPluginParameter({
        trackId: 'track-1',
        instanceId: 'plugin-1',
        parameterId: 'missing-parameter',
        value: 0.5,
      })
    ).toThrowError(expect.objectContaining({ code: ProjectStateErrorCode.PLUGIN_PARAMETER_NOT_FOUND }));
    expect(installPlugin).not.toHaveBeenCalled();
    expect(setPluginParameter).not.toHaveBeenCalled();
  });

  it('Plugin을 AudioEngine에서 제거한 뒤 Session에서 제거한다', () => {
    const { audioEngine, controller, sessionStore } = createTestContext();
    controller.installPlugin({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      manifestId: 'builtin.gain',
      parameterValues: {},
    });
    const removePlugin = vi.spyOn(audioEngine, 'removePlugin');

    controller.removePlugin({ trackId: 'track-1', instanceId: 'plugin-1' });

    expect(removePlugin).toHaveBeenCalledWith('track-1', 'plugin-1');
    expect(sessionStore.getState().tracks.get('track-1')?.pluginInstances).toEqual([]);
  });

  it('Plugin parameter Automation이 남아 있으면 Plugin 제거를 거부한다', () => {
    const { audioEngine, controller, sessionStore } = createTestContext();
    controller.installPlugin({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      manifestId: 'builtin.gain',
      parameterValues: {},
    });
    sessionStore.getState().updateTrack('track-1', {
      automationLanes: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          isEnabled: true,
          mode: 'read',
          points: [],
          target: { kind: 'pluginParameter', parameterId: 'gain', pluginInstanceId: 'plugin-1' },
        },
      ],
    });
    const removePlugin = vi.spyOn(audioEngine, 'removePlugin');

    expect(() => controller.removePlugin({ trackId: 'track-1', instanceId: 'plugin-1' })).toThrowError(
      expect.objectContaining({ code: ProjectStateErrorCode.AUTOMATION_TARGET_IN_USE })
    );
    expect(removePlugin).not.toHaveBeenCalled();
  });

  it('AudioEngine 제거가 실패하면 Session에 Plugin을 유지한다', () => {
    const { audioEngine, controller, sessionStore } = createTestContext();
    controller.installPlugin({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      manifestId: 'builtin.gain',
      parameterValues: {},
    });
    vi.spyOn(audioEngine, 'removePlugin').mockImplementation(() => {
      throw new Error('remove failed');
    });

    expect(() => controller.removePlugin({ trackId: 'track-1', instanceId: 'plugin-1' })).toThrow('remove failed');
    expect(sessionStore.getState().tracks.get('track-1')?.pluginInstances).toHaveLength(1);
  });

  it('Plugin 순서를 AudioEngine 성공 뒤 Session에 반영한다', () => {
    const { audioEngine, controller, sessionStore } = createTestContext();
    ['plugin-1', 'plugin-2'].forEach(instanceId =>
      controller.installPlugin({
        trackId: 'track-1',
        instanceId,
        manifestId: 'builtin.gain',
        parameterValues: {},
      })
    );
    const movePlugin = vi.spyOn(audioEngine, 'movePlugin');

    controller.movePlugin({ trackId: 'track-1', instanceId: 'plugin-1', targetIndex: 1 });

    expect(movePlugin).toHaveBeenCalledWith({ trackId: 'track-1', instanceId: 'plugin-1', targetIndex: 1 });
    expect(
      sessionStore
        .getState()
        .tracks.get('track-1')
        ?.pluginInstances.map(instance => instance.id)
    ).toEqual(['plugin-2', 'plugin-1']);
  });

  it('범위 밖 index를 AudioEngine 호출 전에 거부한다', () => {
    const { audioEngine, controller } = createTestContext();
    controller.installPlugin({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      manifestId: 'builtin.gain',
      parameterValues: {},
    });
    const movePlugin = vi.spyOn(audioEngine, 'movePlugin');

    expect(() => controller.movePlugin({ trackId: 'track-1', instanceId: 'plugin-1', targetIndex: 1 })).toThrowError(
      expect.objectContaining({ code: ProjectStateErrorCode.PLUGIN_TARGET_INDEX_OUT_OF_RANGE })
    );
    expect(movePlugin).not.toHaveBeenCalled();
  });

  it('AudioEngine 순서 변경이 실패하면 Session 순서를 유지한다', () => {
    const { audioEngine, controller, sessionStore } = createTestContext();
    ['plugin-1', 'plugin-2'].forEach(instanceId =>
      controller.installPlugin({
        trackId: 'track-1',
        instanceId,
        manifestId: 'builtin.gain',
        parameterValues: {},
      })
    );
    vi.spyOn(audioEngine, 'movePlugin').mockImplementation(() => {
      throw new Error('move failed');
    });

    expect(() => controller.movePlugin({ trackId: 'track-1', instanceId: 'plugin-1', targetIndex: 1 })).toThrow(
      'move failed'
    );
    expect(
      sessionStore
        .getState()
        .tracks.get('track-1')
        ?.pluginInstances.map(instance => instance.id)
    ).toEqual(['plugin-1', 'plugin-2']);
  });
});
