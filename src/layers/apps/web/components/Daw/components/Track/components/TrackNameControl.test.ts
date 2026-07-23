// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import { TrackNameControl } from './TrackNameControl';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const layerMocks = vi.hoisted(() => ({
  execute: vi.fn<(command: AudioCommand) => Promise<unknown>>(),
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useCommandExecutor: () => ({ execute: layerMocks.execute }),
}));

vi.mock('./TrackNameControl.css.ts', () => ({
  button: 'button',
  form: 'form',
  input: 'input',
  label: 'label',
}));

const mountedRoots: Root[] = [];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderControl(name = '빈 Track') {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);
  act(() => root.render(createElement(TrackNameControl, { trackId: TRACK_ID, name })));

  const input = host.querySelector<HTMLInputElement>('input[name="trackName"]');
  const form = host.querySelector('form');
  if (!input || !form) {
    throw new Error('Track 이름 입력 폼을 찾지 못했습니다.');
  }
  return { form, host, input, root };
}

function changeInput(input: HTMLInputElement, value: string) {
  const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setInputValue) {
    throw new Error('HTML input value setter를 찾지 못했습니다.');
  }
  act(() => {
    setInputValue.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function submitForm(form: HTMLFormElement) {
  const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!submitButton) {
    throw new Error('Track 이름 적용 버튼을 찾지 못했습니다.');
  }
  await act(async () => submitButton.click());
}

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
  layerMocks.execute.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('TrackNameControl', () => {
  it('현재 이름을 표시하고 SET_TRACK_NAME을 실행한다', async () => {
    layerMocks.execute.mockResolvedValue(undefined);
    const { form, input } = renderControl();

    expect(input.value).toBe('빈 Track');
    changeInput(input, '  Lead Vocal  ');
    await submitForm(form);

    expect(layerMocks.execute).toHaveBeenCalledWith({
      type: AudioCommandType.SET_TRACK_NAME,
      trackId: TRACK_ID,
      name: 'Lead Vocal',
    });
  });

  it('빈 이름은 실행하지 않고 현재 이름으로 되돌린다', async () => {
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    const { form, input } = renderControl();

    changeInput(input, '   ');
    await submitForm(form);

    expect(layerMocks.execute).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('Track 이름은 1자부터 255자까지 입력해야 합니다.');
    expect(input.value).toBe('빈 Track');
  });

  it('실행 실패 시 원인을 알리고 현재 이름으로 되돌린다', async () => {
    layerMocks.execute.mockRejectedValue(new Error('저장 오류'));
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    const { form, input } = renderControl();

    changeInput(input, '보컬');
    await submitForm(form);

    expect(alert).toHaveBeenCalledWith('Track 이름을 변경하지 못했습니다: 저장 오류');
    expect(input.value).toBe('빈 Track');
  });

  it('다른 진입점에서 바뀐 이름을 다시 표시한다', () => {
    const { input, root } = renderControl();

    act(() => root.render(createElement(TrackNameControl, { trackId: TRACK_ID, name: '드럼' })));

    expect(input.value).toBe('드럼');
  });
});
