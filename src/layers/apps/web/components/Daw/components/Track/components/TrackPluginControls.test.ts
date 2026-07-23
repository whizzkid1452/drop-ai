// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AudioCommand } from '@/types/audioCommand.schema';
import type { PluginCatalogEntry, PluginInstanceState } from '@/types/plugin-state';
import { AudioCommandType } from '@/types/audioCommand.schema';
import { TrackPluginControls } from './TrackPluginControls';

const trackId = '11111111-1111-4111-8111-111111111111';
const instanceId = '22222222-2222-4222-8222-222222222222';
const pluginCatalog = new Map<string, PluginCatalogEntry>([
  [
    'builtin.multi',
    {
      id: 'builtin.multi',
      name: 'Multi Effect',
      version: '1.0.0',
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

const layerMocks = vi.hoisted(() => ({
  execute: vi.fn<(command: AudioCommand) => Promise<unknown>>(),
  pluginCatalog: new Map<string, PluginCatalogEntry>(),
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useCommandExecutor: () => ({ execute: layerMocks.execute }),
  useSession: (selector: (state: { pluginCatalog: Map<string, PluginCatalogEntry> }) => unknown) =>
    selector({ pluginCatalog: layerMocks.pluginCatalog }),
}));

vi.mock('./TrackPluginControls.css.ts', () => ({
  addButton: 'addButton',
  addControls: 'addControls',
  container: 'container',
  emptyMessage: 'emptyMessage',
  header: 'header',
  instance: 'instance',
  instanceActions: 'instanceActions',
  instanceHeader: 'instanceHeader',
  instanceList: 'instanceList',
  parameter: 'parameter',
  parameterName: 'parameterName',
  parameterValue: 'parameterValue',
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

    expect(host.textContent).toContain('Parameter 정보를 불러올 수 없습니다.');
    expect(host.querySelector('input[name="gain"]')).toBeNull();
    expect(host.querySelector('button[aria-label="Multi Effect Plugin 삭제"]')).not.toBeNull();
  });
});
