// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGlobalKeyboardShortcuts } from '@/layers/apps/web/keyboard-shortcuts/keyboard-shortcuts';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import { SaveProjectButton } from './SaveProjectButton';

const layerMocks = vi.hoisted(() => ({
  execute: vi.fn<(command: AudioCommand) => Promise<unknown>>(),
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useCommandExecutor: () => ({ execute: layerMocks.execute }),
}));

vi.mock('./SaveProjectButton.css.ts', () => ({
  button: 'button',
  container: 'container',
  error: 'error',
  status: 'status',
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

function ShortcutEnabledSaveProjectButton() {
  useGlobalKeyboardShortcuts();
  return createElement(SaveProjectButton);
}

function renderButton() {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);

  act(() => root.render(createElement(ShortcutEnabledSaveProjectButton)));
  const button = host.querySelector('button');
  if (!button) {
    throw new Error('프로젝트 저장 버튼을 찾지 못했습니다.');
  }

  return { button, host };
}

afterEach(() => {
  act(() => {
    mountedRoots.splice(0).forEach(root => root.unmount());
  });
  document.body.replaceChildren();
  layerMocks.execute.mockReset();
});

describe('SaveProjectButton', () => {
  it('클릭하면 SAVE_PROJECT를 실행하고 성공 상태를 표시한다', async () => {
    layerMocks.execute.mockResolvedValue(undefined);
    const { button, host } = renderButton();

    await act(async () => button.click());

    expect(layerMocks.execute).toHaveBeenCalledWith({ type: AudioCommandType.SAVE_PROJECT });
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Save completed');
  });

  it('저장 중에는 중복 실행을 막는다', async () => {
    const execution = createDeferred();
    layerMocks.execute.mockReturnValue(execution.promise);
    const { button } = renderButton();

    act(() => {
      button.click();
      button.click();
    });

    expect(layerMocks.execute).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);

    await act(async () => execution.resolve(undefined));
    expect(button.disabled).toBe(false);
  });

  it('Ctrl+S를 누르면 버튼과 같은 저장 동작을 실행한다', async () => {
    layerMocks.execute.mockResolvedValue(undefined);
    renderButton();

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          code: 'KeyS',
          ctrlKey: true,
        })
      );
    });

    expect(layerMocks.execute).toHaveBeenCalledWith({ type: AudioCommandType.SAVE_PROJECT });
  });

  it('실패 원인을 표시하고 같은 버튼으로 다시 시도한다', async () => {
    layerMocks.execute.mockRejectedValueOnce(new Error('저장 공간을 사용할 수 없습니다.'));
    const { button, host } = renderButton();

    await act(async () => button.click());

    expect(host.querySelector('[role="alert"]')?.textContent).toContain('저장 공간을 사용할 수 없습니다.');
    expect(button.textContent).toBe('Retry save');

    layerMocks.execute.mockResolvedValueOnce(undefined);
    await act(async () => button.click());

    expect(layerMocks.execute).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Save completed');
  });
});
