// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import { UndoRedoControls } from './UndoRedoControls';

const layerMocks = vi.hoisted(() => ({
  execute: vi.fn<(command: AudioCommand) => Promise<unknown>>(),
  history: { canRedo: true, canUndo: true },
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useCommandExecutor: () => ({ execute: layerMocks.execute }),
  useCommandHistory: () => layerMocks.history,
}));

vi.mock('./UndoRedoControls.css.ts', () => ({
  button: 'button',
  container: 'container',
  error: 'error',
}));

const mountedRoots: Root[] = [];
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function renderControls() {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);
  await act(async () => root.render(createElement(UndoRedoControls)));
  return { host };
}

beforeEach(() => {
  layerMocks.execute.mockResolvedValue(undefined);
  layerMocks.history.canUndo = true;
  layerMocks.history.canRedo = true;
});

afterEach(() => {
  act(() => {
    mountedRoots.splice(0).forEach(root => root.unmount());
  });
  document.body.replaceChildren();
  vi.clearAllMocks();
});

describe('UndoRedoControls', () => {
  it('Undo 버튼은 UNDO 명령을 실행한다', async () => {
    const { host } = await renderControls();
    const undoButton = [...host.querySelectorAll('button')].find(button => button.textContent === '실행 취소');
    if (!undoButton) {
      throw new Error('실행 취소 버튼을 찾지 못했습니다.');
    }

    await act(async () => undoButton.click());

    expect(layerMocks.execute).toHaveBeenCalledWith({ type: AudioCommandType.UNDO });
  });

  it('Redo 버튼은 REDO 명령을 실행한다', async () => {
    const { host } = await renderControls();
    const redoButton = [...host.querySelectorAll('button')].find(button => button.textContent === '다시 실행');
    if (!redoButton) {
      throw new Error('다시 실행 버튼을 찾지 못했습니다.');
    }

    await act(async () => redoButton.click());

    expect(layerMocks.execute).toHaveBeenCalledWith({ type: AudioCommandType.REDO });
  });

  it('사용할 기록이 없으면 해당 버튼을 비활성화한다', async () => {
    layerMocks.history.canUndo = false;
    layerMocks.history.canRedo = false;
    const { host } = await renderControls();

    expect([...host.querySelectorAll('button')].every(button => button.hasAttribute('disabled'))).toBe(true);
  });

  it('Undo 실패 이유를 표시한다', async () => {
    layerMocks.execute.mockRejectedValueOnce(new Error('복원 실패'));
    const { host } = await renderControls();
    const undoButton = host.querySelector('button');
    if (!undoButton) {
      throw new Error('실행 취소 버튼을 찾지 못했습니다.');
    }

    await act(async () => undoButton.click());

    expect(host.querySelector('[role="alert"]')?.textContent).toContain('복원 실패');
  });
});
