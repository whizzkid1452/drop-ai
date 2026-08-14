// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AudioCommand } from '@/types/audioCommand.schema';
import type { PluginCatalogEntry, PluginInstanceState, PluginRuntimeState } from '@/types/plugin-state';
import { AudioCommandType } from '@/types/audioCommand.schema';
import { TrackPluginControls } from './TrackPluginControls';

const trackId = '11111111-1111-4111-8111-111111111111';
const instanceId = '22222222-2222-4222-8222-222222222222';
const secondInstanceId = '33333333-3333-4333-8333-333333333333';
const pluginCatalog = new Map<string, PluginCatalogEntry>([
  [
    'builtin.multi',
    {
      id: 'builtin.multi',
      name: 'Multi Effect',
      version: '1.0.0',
      category: 'utility',
      presets: [{ id: 'warm', name: 'Warm', parameterValues: { gain: 1.5 } }],
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
        { id: 'enabled', name: 'Enabled', type: 'boolean', defaultValue: true },
        {
          id: 'mode',
          name: 'Mode',
          type: 'enum',
          defaultValue: 'clean',
          options: [
            { value: 'clean', name: 'Clean' },
            { value: 'warm', name: 'Warm' },
          ],
        },
      ],
    },
  ],
]);
const pluginInstances: PluginInstanceState[] = [
  {
    id: instanceId,
    manifestSummary: { id: 'builtin.multi', name: 'Multi Effect', version: '1.0.0' },
    isEnabled: true,
    parameters: [
      { id: 'gain', value: 1.25 },
      { id: 'enabled', value: true },
      { id: 'mode', value: 'clean' },
    ],
  },
];
const orderedPluginInstances: PluginInstanceState[] = [
  pluginInstances[0],
  {
    ...pluginInstances[0],
    id: secondInstanceId,
  },
];

const layerMocks = vi.hoisted(() => ({
  execute: vi.fn<(command: AudioCommand) => Promise<unknown>>(),
  pluginCatalog: new Map<string, PluginCatalogEntry>(),
  favoritePluginManifestIds: new Set<string>(),
  tracks: new Map([
    ['11111111-1111-4111-8111-111111111111', { id: '11111111-1111-4111-8111-111111111111', name: 'Track 1' }],
    ['44444444-4444-4444-8444-444444444444', { id: '44444444-4444-4444-8444-444444444444', name: 'Kick' }],
  ]),
  runtimeStates: [
    { instanceId: '22222222-2222-4222-8222-222222222222', latencySamples: 64, reason: null, status: 'active' },
    {
      instanceId: '33333333-3333-4333-8333-333333333333',
      latencySamples: 0,
      reason: null,
      status: 'active',
    },
  ] as PluginRuntimeState[],
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useCommandExecutor: () => ({ execute: layerMocks.execute }),
  usePluginRuntimeQuery: () => ({ readTrack: () => layerMocks.runtimeStates }),
  useSession: (selector: (state: unknown) => unknown) =>
    selector({
      pluginCatalog: layerMocks.pluginCatalog,
      favoritePluginManifestIds: layerMocks.favoritePluginManifestIds,
      tracks: layerMocks.tracks,
    }),
}));

vi.mock('./TrackPluginControls.css.ts', () => ({
  addButton: 'addButton',
  addControls: 'addControls',
  browserControls: 'browserControls',
  container: 'container',
  emptyMessage: 'emptyMessage',
  favoriteFilter: 'favoriteFilter',
  header: 'header',
  instance: 'instance',
  instanceActions: 'instanceActions',
  instanceHeader: 'instanceHeader',
  instanceList: 'instanceList',
  parameter: 'parameter',
  parameterName: 'parameterName',
  parameterValue: 'parameterValue',
  runtimeBadge: 'runtimeBadge',
  runtimeReason: 'runtimeReason',
  searchInput: 'searchInput',
  settingRow: 'settingRow',
  removeButton: 'removeButton',
  toggleButton: 'toggleButton',
  select: 'select',
  title: 'title',
}));

const mountedRoots: Root[] = [];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createDeferred() {
  let resolve: (value: unknown) => void = () => undefined;
  const promise = new Promise<unknown>(promiseResolve => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function renderControls(instances: readonly PluginInstanceState[] = []) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);

  act(() => root.render(createElement(TrackPluginControls, { trackId, pluginInstances: instances })));

  return host;
}

function changeInput(input: HTMLInputElement | HTMLSelectElement, value: string) {
  const inputPrototype = input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setInputValue = Object.getOwnPropertyDescriptor(inputPrototype, 'value')?.set;
  if (!setInputValue) {
    throw new Error('입력값 setter를 찾지 못했습니다.');
  }

  act(() => {
    setInputValue.call(input, value);
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
  layerMocks.execute.mockReset();
  layerMocks.pluginCatalog = new Map();
  layerMocks.favoritePluginManifestIds = new Set();
  layerMocks.runtimeStates = [
    { instanceId, latencySamples: 64, reason: null, status: 'active' },
    { instanceId: secondInstanceId, latencySamples: 0, reason: null, status: 'active' },
  ];
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('TrackPluginControls', () => {
  it('catalog에서 선택한 Plugin을 INSTALL_PLUGIN 명령으로 설치한다', async () => {
    layerMocks.pluginCatalog = pluginCatalog;
    layerMocks.execute.mockResolvedValue(undefined);
    const host = renderControls();
    const installButton = host.querySelector<HTMLButtonElement>('button[aria-label="Plugin 설치"]');
    if (!installButton) {
      throw new Error('Plugin 설치 버튼을 찾지 못했습니다.');
    }

    await act(async () => installButton.click());

    expect(layerMocks.execute).toHaveBeenCalledWith({
      type: AudioCommandType.INSTALL_PLUGIN,
      trackId,
      manifestId: 'builtin.multi',
    });
  });

  it('현재 파라미터를 표시하고 타입에 맞는 SET_PLUGIN_PARAMETER 명령을 실행한다', async () => {
    layerMocks.pluginCatalog = pluginCatalog;
    layerMocks.execute.mockResolvedValue(undefined);
    const host = renderControls(pluginInstances);
    const gainInput = host.querySelector<HTMLInputElement>('input[name="gain"]');
    const enabledInput = host.querySelector<HTMLInputElement>('input[name="enabled"]');
    const modeSelect = host.querySelector<HTMLSelectElement>('select[name="mode"]');
    if (!gainInput || !enabledInput || !modeSelect) {
      throw new Error('Plugin 파라미터 입력을 찾지 못했습니다.');
    }

    expect(gainInput.value).toBe('1.25');
    expect(enabledInput.checked).toBe(true);
    expect(modeSelect.value).toBe('clean');

    changeInput(gainInput, '1.5');
    await act(async () => undefined);
    act(() => enabledInput.click());
    await act(async () => undefined);
    changeInput(modeSelect, 'warm');
    await act(async () => undefined);

    expect(layerMocks.execute.mock.calls.map(call => call[0])).toEqual([
      {
        type: AudioCommandType.SET_PLUGIN_PARAMETER,
        trackId,
        instanceId,
        parameterId: 'gain',
        value: 1.5,
      },
      {
        type: AudioCommandType.SET_PLUGIN_PARAMETER,
        trackId,
        instanceId,
        parameterId: 'enabled',
        value: false,
      },
      {
        type: AudioCommandType.SET_PLUGIN_PARAMETER,
        trackId,
        instanceId,
        parameterId: 'mode',
        value: 'warm',
      },
    ]);
  });

  it('선택한 인스턴스를 REMOVE_PLUGIN 명령으로 삭제한다', async () => {
    layerMocks.pluginCatalog = pluginCatalog;
    layerMocks.execute.mockResolvedValue(undefined);
    const host = renderControls(pluginInstances);
    const removeButton = host.querySelector<HTMLButtonElement>('button[aria-label="Multi Effect Plugin 삭제"]');
    if (!removeButton) {
      throw new Error('Plugin 삭제 버튼을 찾지 못했습니다.');
    }

    await act(async () => removeButton.click());

    expect(layerMocks.execute).toHaveBeenCalledWith({
      type: AudioCommandType.REMOVE_PLUGIN,
      trackId,
      instanceId,
    });
  });

  it('Plugin 끄기 버튼을 SET_PLUGIN_ENABLED 명령으로 실행한다', async () => {
    layerMocks.pluginCatalog = pluginCatalog;
    layerMocks.execute.mockResolvedValue(undefined);
    const host = renderControls(pluginInstances);
    const toggleButton = host.querySelector<HTMLButtonElement>('button[aria-label="Multi Effect Plugin 비활성화"]');
    if (!toggleButton) {
      throw new Error('Plugin 끄기 버튼을 찾지 못했습니다.');
    }

    await act(async () => toggleButton.click());

    expect(layerMocks.execute).toHaveBeenCalledWith({
      type: AudioCommandType.SET_PLUGIN_ENABLED,
      trackId,
      instanceId,
      isEnabled: false,
    });
  });

  it('Plugin 아래 이동 버튼을 MOVE_PLUGIN 명령으로 실행한다', async () => {
    layerMocks.pluginCatalog = pluginCatalog;
    layerMocks.execute.mockResolvedValue(undefined);
    const host = renderControls(orderedPluginInstances);
    const moveDownButtons = host.querySelectorAll<HTMLButtonElement>(
      'button[aria-label="Multi Effect Plugin 아래로 이동"]'
    );
    if (!moveDownButtons[0]) {
      throw new Error('Plugin 아래 이동 버튼을 찾지 못했습니다.');
    }

    await act(async () => moveDownButtons[0].click());

    expect(layerMocks.execute).toHaveBeenCalledWith({
      type: AudioCommandType.MOVE_PLUGIN,
      trackId,
      instanceId,
      targetIndex: 1,
    });
  });

  it('Plugin 순서의 양 끝에서는 바깥 방향 이동을 막는다', () => {
    layerMocks.pluginCatalog = pluginCatalog;
    const host = renderControls(orderedPluginInstances);
    const moveUpButtons = host.querySelectorAll<HTMLButtonElement>(
      'button[aria-label="Multi Effect Plugin 위로 이동"]'
    );
    const moveDownButtons = host.querySelectorAll<HTMLButtonElement>(
      'button[aria-label="Multi Effect Plugin 아래로 이동"]'
    );

    expect(moveUpButtons[0]?.disabled).toBe(true);
    expect(moveDownButtons[0]?.disabled).toBe(false);
    expect(moveUpButtons[1]?.disabled).toBe(false);
    expect(moveDownButtons[1]?.disabled).toBe(true);
  });

  it('명령 처리 중에는 중복 실행을 막는다', async () => {
    layerMocks.pluginCatalog = pluginCatalog;
    const execution = createDeferred();
    layerMocks.execute.mockReturnValue(execution.promise);
    const host = renderControls();
    const installButton = host.querySelector<HTMLButtonElement>('button[aria-label="Plugin 설치"]');
    if (!installButton) {
      throw new Error('Plugin 설치 버튼을 찾지 못했습니다.');
    }

    await act(async () => installButton.click());
    await act(async () => installButton.click());

    expect(layerMocks.execute).toHaveBeenCalledTimes(1);
    expect(installButton.disabled).toBe(true);

    await act(async () => execution.resolve(undefined));

    expect(installButton.disabled).toBe(false);
  });

  it('catalog에 없는 기존 인스턴스는 삭제만 허용한다', () => {
    const host = renderControls(pluginInstances);

    expect(host.textContent).toContain('Plugin runtime과 Parameter 정보를 찾을 수 없습니다.');
    expect(host.querySelector('input[name="gain"]')).toBeNull();
    expect(host.querySelector('button[aria-label="Multi Effect Plugin 삭제"]')).not.toBeNull();
  });

  it('검색으로 설치 가능한 Plugin을 좁힌다', () => {
    layerMocks.pluginCatalog = new Map([
      ...pluginCatalog,
      ['builtin.echo', { id: 'builtin.echo', name: 'Echo', version: '1.0.0', category: 'delay', parameters: [] }],
    ]);
    const host = renderControls();
    const searchInput = host.querySelector<HTMLInputElement>('input[aria-label="Plugin 검색"]');
    const pluginSelect = host.querySelector<HTMLSelectElement>('select[aria-label="설치할 Plugin"]');
    if (!searchInput || !pluginSelect) {
      throw new Error('Plugin 검색 UI를 찾을 수 없습니다.');
    }

    changeInput(searchInput, 'echo');

    expect([...pluginSelect.options].map(option => option.value)).toEqual(['builtin.echo']);
  });

  it('Preset과 sidechain source 변경 명령을 실행한다', async () => {
    layerMocks.pluginCatalog = pluginCatalog;
    layerMocks.execute.mockResolvedValue(undefined);
    const host = renderControls(pluginInstances);
    const presetSelect = host.querySelector<HTMLSelectElement>('select[aria-label="Multi Effect Preset"]');
    const sidechainSelect = host.querySelector<HTMLSelectElement>('select[aria-label="Multi Effect Sidechain source"]');
    if (!presetSelect || !sidechainSelect) {
      throw new Error('Preset 또는 sidechain UI를 찾을 수 없습니다.');
    }

    changeInput(presetSelect, 'warm');
    await act(async () => undefined);
    changeInput(sidechainSelect, '44444444-4444-4444-8444-444444444444');
    await act(async () => undefined);

    expect(layerMocks.execute.mock.calls.map(call => call[0])).toEqual([
      { type: AudioCommandType.APPLY_PLUGIN_PRESET, trackId, instanceId, presetId: 'warm' },
      {
        type: AudioCommandType.SET_PLUGIN_SIDECHAIN,
        trackId,
        instanceId,
        sourceTrackId: '44444444-4444-4444-8444-444444444444',
      },
    ]);
  });

  it('실패한 runtime의 이유를 표시하고 편집만 비활성화한다', () => {
    layerMocks.pluginCatalog = pluginCatalog;
    layerMocks.runtimeStates = [
      { instanceId, latencySamples: 0, reason: 'AudioWorklet 초기화 실패', status: 'failed' },
    ];
    const host = renderControls(pluginInstances);

    expect(host.textContent).toContain('AudioWorklet 초기화 실패');
    expect(host.querySelector<HTMLInputElement>('input[name="gain"]')?.disabled).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('button[aria-label="Multi Effect Plugin 삭제"]')?.disabled).toBe(
      false
    );
  });
});
