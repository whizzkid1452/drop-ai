// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import { MasterVolumeControl } from './MasterVolumeControl';

const layerMocks = vi.hoisted(() => ({
  masterVolume: 1,
  execute: vi.fn<(command: AudioCommand) => Promise<unknown>>(),
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useCommandExecutor: () => ({ execute: layerMocks.execute }),
  useSession: (selector: (state: { masterVolume: number }) => unknown) =>
    selector({ masterVolume: layerMocks.masterVolume }),
}));

vi.mock('./MasterVolumeControl.css.ts', () => ({
  button: 'button',
  form: 'form',
  input: 'input',
  label: 'label',
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

  act(() => root.render(createElement(MasterVolumeControl)));

  const input = host.querySelector<HTMLInputElement>('input[name="masterVolume"]');
  const form = host.querySelector('form');
  if (!input || !form) {
    throw new Error('Master Volume 입력 폼을 찾지 못했습니다.');
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
    throw new Error('Master Volume 적용 버튼을 찾지 못했습니다.');
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
  layerMocks.masterVolume = 1;
  layerMocks.execute.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('MasterVolumeControl', () => {
  it('현재 Session 값을 표시하고 정확한 SET_MASTER_VOLUME 명령을 실행한다', async () => {
    layerMocks.masterVolume = 0.8;
    layerMocks.execute.mockResolvedValue(undefined);
    const { form, input } = renderControl();

    expect(input.value).toBe('0.8');
    changeInput(input, '0.4');
    await submitForm(form);

    expect(layerMocks.execute).toHaveBeenCalledTimes(1);
    expect(layerMocks.execute).toHaveBeenCalledWith({
      type: AudioCommandType.SET_MASTER_VOLUME,
      volume: 0.4,
    });
  });

  it('잘못된 값은 실행하지 않고 Session 값으로 되돌린다', async () => {
    layerMocks.masterVolume = 0.8;
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    const { form, input } = renderControl();

    changeInput(input, '1.1');
    await submitForm(form);

    expect(layerMocks.execute).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('Master Volume은 0부터 1 사이의 숫자여야 합니다.');
    expect(input.value).toBe('0.8');
  });

  it('실행 실패 시 원인을 알리고 Session 값으로 되돌린다', async () => {
    layerMocks.masterVolume = 0.8;
    layerMocks.execute.mockRejectedValue(new Error('출력 오류'));
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    const { form, input } = renderControl();

    changeInput(input, '0.4');
    await submitForm(form);

    expect(alert).toHaveBeenCalledWith('Master Volume을 변경하지 못했습니다: 출력 오류');
    expect(input.value).toBe('0.8');
  });

  it('Agent나 CLI가 바꾼 Session 값을 다시 표시한다', () => {
    const { input, root } = renderControl();

    layerMocks.masterVolume = 0.3;
    act(() => root.render(createElement(MasterVolumeControl)));

    expect(input.value).toBe('0.3');
  });

  it('처리 중에는 중복 실행과 추가 입력을 막는다', async () => {
    const execution = createDeferred();
    layerMocks.execute.mockReturnValue(execution.promise);
    const { form, host, input } = renderControl();
    changeInput(input, '0.4');

    await submitForm(form);
    await submitForm(form);

    expect(layerMocks.execute).toHaveBeenCalledTimes(1);
    expect(input.disabled).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);

    await act(async () => execution.resolve(undefined));

    expect(input.disabled).toBe(false);
  });
});
