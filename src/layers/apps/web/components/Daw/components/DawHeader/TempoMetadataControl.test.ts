// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import { TempoMetadataControl } from './TempoMetadataControl';

const layerMocks = vi.hoisted(() => ({
  tempo: 120,
  execute: vi.fn<(command: AudioCommand) => Promise<unknown>>(),
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useCommandExecutor: () => ({ execute: layerMocks.execute }),
  useSession: (selector: (state: { tempo: number }) => unknown) => selector({ tempo: layerMocks.tempo }),
}));

vi.mock('./TempoMetadataControl.css.ts', () => ({
  button: 'button',
  form: 'form',
  hint: 'hint',
  input: 'input',
  label: 'label',
  unit: 'unit',
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

function renderControl() {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);

  act(() => root.render(createElement(TempoMetadataControl)));

  const input = host.querySelector<HTMLInputElement>('input[name="tempo"]');
  const form = host.querySelector('form');
  if (!input || !form) {
    throw new Error('Tempo 메타데이터 입력 폼을 찾지 못했습니다.');
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
    throw new Error('Tempo 적용 버튼을 찾지 못했습니다.');
  }

  await act(async () => {
    submitButton.click();
  });
}

afterEach(() => {
  act(() => {
    mountedRoots.splice(0).forEach(root => root.unmount());
  });
  document.body.replaceChildren();
  layerMocks.tempo = 120;
  layerMocks.execute.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('TempoMetadataControl', () => {
  it('현재 Session Tempo를 표시하고 정확한 SET_TEMPO 명령을 실행한다', async () => {
    layerMocks.execute.mockResolvedValue(undefined);
    const { form, input } = renderControl();

    expect(input.value).toBe('120');
    expect(form.title).toContain('오디오 속도는 바뀌지 않습니다');
    changeInput(input, '128.555');
    await submitForm(form);

    expect(layerMocks.execute).toHaveBeenCalledTimes(1);
    expect(layerMocks.execute).toHaveBeenCalledWith({ type: AudioCommandType.SET_TEMPO, tempo: 128.555 });
  });

  it('잘못된 값은 실행하지 않고 Session 값으로 되돌린다', async () => {
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    const { form, input } = renderControl();

    changeInput(input, '0');
    await submitForm(form);

    expect(layerMocks.execute).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('Tempo는 0보다 큰 숫자여야 합니다.');
    expect(input.value).toBe('120');
  });

  it('실행 실패 시 원인을 알리고 Session 값으로 되돌린다', async () => {
    layerMocks.execute.mockRejectedValue(new Error('저장 오류'));
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    const { form, input } = renderControl();

    changeInput(input, '140');
    await submitForm(form);

    expect(alert).toHaveBeenCalledWith('Tempo를 변경하지 못했습니다: 저장 오류');
    expect(input.value).toBe('120');
  });

  it('Agent나 CLI가 바꾼 Session Tempo를 다시 표시한다', () => {
    const { input, root } = renderControl();

    layerMocks.tempo = 140;
    act(() => root.render(createElement(TempoMetadataControl)));

    expect(input.value).toBe('140');
  });

  it('처리 중에는 중복 실행과 추가 입력을 막는다', async () => {
    const execution = createDeferred();
    layerMocks.execute.mockReturnValue(execution.promise);
    const { form, host, input } = renderControl();
    changeInput(input, '140');

    await submitForm(form);
    await submitForm(form);

    expect(layerMocks.execute).toHaveBeenCalledTimes(1);
    expect(input.disabled).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);

    await act(async () => execution.resolve(undefined));

    expect(input.disabled).toBe(false);
  });
});
