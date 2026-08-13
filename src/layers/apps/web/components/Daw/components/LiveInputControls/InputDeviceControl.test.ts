// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AudioCommand } from '@/layers/shared/types/audioCommand.schema';
import { AudioCommandType } from '@/layers/shared/types/audioCommand.schema';
import { AudioRuntimeFeature, type AudioRuntimeCapabilities } from '@/layers/shared/utils/audio-runtime-capabilities';
import { InputDeviceControl } from './InputDeviceControl';

const controlMocks = vi.hoisted(() => ({
  capabilities: null as AudioRuntimeCapabilities | null,
  execute: vi.fn<(command: AudioCommand) => Promise<unknown>>(),
  liveInputQuery: { listDevices: vi.fn() },
  state: { deviceId: null as string | null, monitoringTrackId: null as string | null },
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useAudioRuntimeCapabilities: () => controlMocks.capabilities,
  useCommandExecutor: () => ({ execute: controlMocks.execute }),
  useLiveInputQuery: () => controlMocks.liveInputQuery,
  useLiveInputRuntimeState: () => controlMocks.state,
}));

vi.mock('../AudioLevelMeter/AudioLevelMeter', () => ({
  AudioLevelMeter: () => createElement('div', { 'data-testid': 'input-meter' }),
}));

vi.mock('./LiveInputControls.css.ts', () => ({
  button: 'button',
  control: 'control',
  error: 'error',
  select: 'select',
}));

const availableCapabilities = {
  blockers: { audioWorklet: [], liveInput: [], sharedMemory: [], wasm: [] },
  features: {
    [AudioRuntimeFeature.LIVE_INPUT]: { blockers: [], status: 'available' },
  },
  meetsAudioWorkletPreconditions: true,
  meetsLiveInputPreconditions: true,
  meetsSharedMemoryPreconditions: true,
  meetsWasmPreconditions: true,
} as unknown as AudioRuntimeCapabilities;
const mountedRoots: Root[] = [];
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function renderControl(): Promise<HTMLElement> {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);
  await act(async () => root.render(createElement(InputDeviceControl)));
  return host;
}

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
  controlMocks.capabilities = availableCapabilities;
  controlMocks.state = { deviceId: null, monitoringTrackId: null };
  controlMocks.execute.mockReset();
  controlMocks.liveInputQuery.listDevices.mockReset();
});

describe('InputDeviceControl', () => {
  it('장치를 선택하고 SET_AUDIO_INPUT_DEVICE 명령으로 연결한다', async () => {
    controlMocks.capabilities = availableCapabilities;
    controlMocks.liveInputQuery.listDevices.mockResolvedValue([{ deviceId: 'mic-1', label: 'Studio Mic' }]);
    controlMocks.execute.mockResolvedValue(undefined);
    const host = await renderControl();
    const select = host.querySelector<HTMLSelectElement>('[aria-label="입력 장치"]');
    const connectButton = host.querySelector<HTMLButtonElement>('button[aria-label="입력 장치 연결"]');

    act(() => {
      if (select) {
        select.value = 'mic-1';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await act(async () => connectButton?.click());

    expect(controlMocks.execute).toHaveBeenCalledWith({
      deviceId: 'mic-1',
      type: AudioCommandType.SET_AUDIO_INPUT_DEVICE,
    });
    expect(host.querySelector('[data-testid="input-meter"]')).not.toBeNull();
  });

  it('실시간 입력이 차단되면 이유를 표시하고 제어를 비활성화한다', async () => {
    controlMocks.capabilities = {
      ...availableCapabilities,
      features: {
        ...availableCapabilities.features,
        [AudioRuntimeFeature.LIVE_INPUT]: { blockers: [], status: 'unsupported' },
      },
    };
    controlMocks.liveInputQuery.listDevices.mockResolvedValue([]);
    const host = await renderControl();

    expect(host.querySelector<HTMLSelectElement>('[aria-label="입력 장치"]')?.disabled).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('button[aria-label="입력 장치 연결"]')?.disabled).toBe(true);
    expect(host.querySelector('[role="group"]')?.getAttribute('title')).toContain('현재 runtime에 구현되지 않음');
  });
});
