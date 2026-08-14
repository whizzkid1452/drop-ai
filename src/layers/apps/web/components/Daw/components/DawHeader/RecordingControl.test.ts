// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioCommandType } from '@/layers/shared/types/audioCommand.schema';
import { RecordingControl } from './RecordingControl';

const layerMocks = vi.hoisted(() => ({
  capability: { blockers: [], status: 'available' as 'available' | 'unavailable' },
  execute: vi.fn().mockResolvedValue(undefined),
  state: {
    armedTrackIds: ['track-1'] as string[],
    inputRoutes: [{ channelIndex: 0, deviceId: null, trackId: 'track-1' }],
    phase: 'idle' as 'idle' | 'recording' | 'scheduled' | 'stopping',
  },
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useAudioRuntimeCapabilities: () => ({ features: { linearRecording: layerMocks.capability } }),
  useCommandExecutor: () => ({ execute: layerMocks.execute }),
  useRecordingRuntimeState: () => ({ ...layerMocks.state, recordStartTimeSeconds: null }),
}));

vi.mock('./RecordingControl.css.ts', () => ({
  button: 'button',
  container: 'container',
  error: 'error',
  field: 'field',
  input: 'input',
  recordingButton: 'recordingButton',
  recordingButtonActive: 'recordingButtonActive',
  status: 'status',
}));

const mountedRoots: Root[] = [];
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderControl(): HTMLElement {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);
  act(() => root.render(createElement(RecordingControl)));
  return host;
}

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
  layerMocks.execute.mockClear();
  layerMocks.capability.status = 'available';
  layerMocks.state.armedTrackIds = ['track-1'];
  layerMocks.state.phase = 'idle';
});

describe('RecordingControl', () => {
  it('count-in과 preroll 값을 START_RECORDING 명령으로 보낸다', async () => {
    const host = renderControl();
    const countIn = host.querySelector<HTMLSelectElement>('[aria-label="Count-in 마디"]');
    const preroll = host.querySelector<HTMLInputElement>('[aria-label="Preroll 초"]');
    const recordButton = host.querySelector<HTMLButtonElement>('[aria-label="녹음 시작"]');

    await act(async () => {
      if (countIn) {
        countIn.value = '2';
        countIn.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (preroll) {
        const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (!setInputValue) {
          throw new Error('HTML input value setter를 찾지 못했습니다.');
        }
        setInputValue.call(preroll, '1.5');
        preroll.dispatchEvent(new Event('input', { bubbles: true }));
      }
      recordButton?.click();
    });

    expect(layerMocks.execute).toHaveBeenCalledWith({
      countInBars: 2,
      prerollSeconds: 1.5,
      type: AudioCommandType.START_RECORDING,
    });
  });

  it('녹음 중에는 STOP_RECORDING 명령을 실행한다', async () => {
    layerMocks.state.phase = 'recording';
    const host = renderControl();

    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="녹음 중지"]')?.click());

    expect(layerMocks.execute).toHaveBeenCalledWith({ type: AudioCommandType.STOP_RECORDING });
  });

  it('arm된 Track이 없으면 녹음 시작을 비활성화한다', () => {
    layerMocks.state.armedTrackIds = [];
    const host = renderControl();

    expect(host.querySelector<HTMLButtonElement>('[aria-label="녹음 시작"]')?.disabled).toBe(true);
  });
});
