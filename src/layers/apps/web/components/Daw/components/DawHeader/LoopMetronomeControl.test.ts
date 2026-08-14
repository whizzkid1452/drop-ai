// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import { LoopMetronomeControl } from './LoopMetronomeControl';

const layerMocks = vi.hoisted(() => ({
  capability: { blockers: [] as string[], status: 'available' },
  execute: vi.fn<(command: AudioCommand) => Promise<unknown>>().mockResolvedValue(undefined),
  state: {
    isLoopEnabled: false,
    isMetronomeEnabled: false,
    loopRange: { startTimeSeconds: 2, endTimeSeconds: 6 },
    metronomeVolume: 0.8,
  },
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useAudioRuntimeCapabilities: () => ({ features: { tempoLoopMetronome: layerMocks.capability } }),
  useCommandExecutor: () => ({ execute: layerMocks.execute }),
  useSession: (selector: (state: typeof layerMocks.state) => unknown) => selector(layerMocks.state),
}));

vi.mock('@/layers/apps/web/utils/audio-runtime-capability-labels', () => ({
  describeAudioRuntimeFeatureCapability: () => '현재 브라우저에서 사용할 수 없음',
}));

vi.mock('./LoopMetronomeControl.css.ts', () => ({
  button: 'button',
  container: 'container',
  error: 'error',
  range: 'range',
  rangeLabel: 'rangeLabel',
  volume: 'volume',
}));

const mountedRoots: Root[] = [];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
  layerMocks.capability = { blockers: [], status: 'available' };
  layerMocks.execute.mockReset().mockResolvedValue(undefined);
  layerMocks.state.isLoopEnabled = false;
  layerMocks.state.isMetronomeEnabled = false;
  layerMocks.state.loopRange = { startTimeSeconds: 2, endTimeSeconds: 6 };
  layerMocks.state.metronomeVolume = 0.8;
});

describe('LoopMetronomeControl', () => {
  it('설정된 Loop 범위를 활성화하는 명령을 실행한다', async () => {
    const host = renderControl();
    const loopButton = host.querySelector<HTMLButtonElement>('[aria-label="Loop 켜기"]');

    await act(async () => loopButton?.click());

    expect(layerMocks.execute).toHaveBeenCalledWith({
      type: AudioCommandType.SET_LOOP_ENABLED,
      isEnabled: true,
    });
  });

  it('Metronome 상태와 볼륨을 명령으로 변경한다', async () => {
    const host = renderControl();
    const metronomeButton = host.querySelector<HTMLButtonElement>('[aria-label="Metronome 켜기"]');
    const volumeInput = host.querySelector<HTMLInputElement>('[aria-label="Metronome 볼륨"]');

    await act(async () => metronomeButton?.click());
    expect(layerMocks.execute).toHaveBeenLastCalledWith({
      type: AudioCommandType.SET_METRONOME,
      isEnabled: true,
      volume: 0.8,
    });

    if (!volumeInput) {
      throw new Error('Metronome 볼륨 입력을 찾지 못했습니다.');
    }
    const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setInputValue) {
      throw new Error('HTML input value setter를 찾지 못했습니다.');
    }
    await act(async () => {
      setInputValue.call(volumeInput, '0.4');
      volumeInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(layerMocks.execute).toHaveBeenLastCalledWith({
      type: AudioCommandType.SET_METRONOME,
      isEnabled: false,
      volume: 0.4,
    });
  });

  it('capability가 available이 아니면 제어를 차단하고 이유를 표시한다', () => {
    layerMocks.capability = { blockers: ['AUDIO_WORKLET_API_UNAVAILABLE'], status: 'blocked' };
    const host = renderControl();

    expect(Array.from(host.querySelectorAll('button, input')).every(control => control.hasAttribute('disabled'))).toBe(
      true
    );
    expect(host.querySelector('[role="group"]')?.getAttribute('title')).toBe('현재 브라우저에서 사용할 수 없음');
  });
});

function renderControl(): HTMLDivElement {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);
  act(() => root.render(createElement(LoopMetronomeControl)));
  return host;
}
