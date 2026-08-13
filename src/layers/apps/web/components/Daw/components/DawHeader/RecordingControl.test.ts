// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioCommandType } from '@/layers/shared/types/audioCommand.schema';
import { RecordingControl } from './RecordingControl';

const layerMocks = vi.hoisted(() => ({
  capability: { blockers: [], status: 'available' as 'available' | 'unavailable' },
  execute: vi.fn().mockResolvedValue(undefined),
  punch: { isEnabled: false, range: null as { endTimeSeconds: number; startTimeSeconds: number } | null },
  selectionRange: { endTimeSeconds: 8, startTimeSeconds: 4, trackIds: ['track-1'] },
  state: {
    armedTrackIds: ['track-1'] as string[],
    inputRoutes: [{ channelIndex: 0, deviceId: null, trackId: 'track-1' }],
    phase: 'idle' as 'idle' | 'recording' | 'scheduled' | 'stopping',
  },
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useAudioRuntimeCapabilities: () => ({ features: { linearRecording: layerMocks.capability } }),
  useCommandExecutor: () => ({ execute: layerMocks.execute }),
  useEditorRuntimeState: () => ({ selection: { range: layerMocks.selectionRange } }),
  useRecordingRuntimeState: () => ({ ...layerMocks.state, recordStartTimeSeconds: null }),
  useSession: (selector: (state: { recording: { punch: typeof layerMocks.punch } }) => unknown) =>
    selector({ recording: { punch: layerMocks.punch } }),
}));

vi.mock('./RecordingControl.css.ts', () => ({
  button: 'button',
  container: 'container',
  error: 'error',
  field: 'field',
  input: 'input',
  punchButtonActive: 'punchButtonActive',
  rangeStatus: 'rangeStatus',
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
  layerMocks.punch = { isEnabled: false, range: null };
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

  it('Editor 선택 범위를 활성 Punch 범위로 보낸다', async () => {
    const host = renderControl();

    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="선택 범위를 Punch로 설정"]')?.click());

    expect(layerMocks.execute).toHaveBeenCalledWith({
      isEnabled: true,
      range: { endTimeSeconds: 8, startTimeSeconds: 4 },
      type: AudioCommandType.SET_PUNCH_RECORDING,
    });
  });

  it('설정된 Punch 범위를 유지하며 Punch를 끈다', async () => {
    layerMocks.punch = { isEnabled: true, range: { endTimeSeconds: 8, startTimeSeconds: 4 } };
    const host = renderControl();

    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Punch 녹음 끄기"]')?.click());

    expect(layerMocks.execute).toHaveBeenCalledWith({
      isEnabled: false,
      range: { endTimeSeconds: 8, startTimeSeconds: 4 },
      type: AudioCommandType.SET_PUNCH_RECORDING,
    });
  });

  it('일부 Track 녹음 실패를 성공 결과와 구분해 표시한다', async () => {
    layerMocks.state.phase = 'recording';
    layerMocks.execute.mockResolvedValueOnce({
      failures: [{ cause: new Error('저장 실패'), stage: 'persist', trackId: 'track-2' }],
      takes: [],
    });
    const host = renderControl();

    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="녹음 중지"]')?.click());

    expect(host.textContent).toContain('1개 Track 녹음 실패: track-2 (persist)');
  });
});
