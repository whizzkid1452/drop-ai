// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGlobalKeyboardShortcuts } from '@/layers/apps/web/keyboard-shortcuts/keyboard-shortcuts';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import { PlaybackControls } from './PlaybackControls';

const layerMocks = vi.hoisted(() => ({
  execute: vi.fn<(command: AudioCommand) => Promise<unknown>>(),
  isPlaying: false,
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useCommandExecutor: () => ({ execute: layerMocks.execute }),
  useSession: (selector: (state: { isPlaying: boolean }) => unknown) => selector({ isPlaying: layerMocks.isPlaying }),
}));

vi.mock('./PlaybackControls.css.ts', () => ({
  button: 'button',
  container: 'container',
  inlineContainer: 'inlineContainer',
  playButton: 'playButton',
}));

const mountedRoots: Root[] = [];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function ShortcutEnabledPlaybackControls() {
  useGlobalKeyboardShortcuts();
  return createElement(PlaybackControls);
}

function renderControls() {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);
  act(() => root.render(createElement(ShortcutEnabledPlaybackControls)));
}

async function pressShortcut(code: string, shiftKey = false) {
  await act(async () => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        code,
        shiftKey,
      })
    );
  });
}

beforeEach(() => {
  layerMocks.execute.mockResolvedValue(undefined);
  layerMocks.isPlaying = false;
});

afterEach(() => {
  act(() => {
    mountedRoots.splice(0).forEach(root => root.unmount());
  });
  document.body.replaceChildren();
  layerMocks.execute.mockReset();
});

describe('PlaybackControls 단축키', () => {
  it('정지 상태에서 Space를 누르면 재생한다', async () => {
    renderControls();

    await pressShortcut('Space');

    expect(layerMocks.execute).toHaveBeenCalledWith({ type: AudioCommandType.PLAY });
  });

  it('재생 중 Space를 누르면 현재 위치에서 일시정지한다', async () => {
    layerMocks.isPlaying = true;
    renderControls();

    await pressShortcut('Space');

    expect(layerMocks.execute).toHaveBeenCalledWith({ type: AudioCommandType.PAUSE });
  });

  it('Shift+Space를 누르면 정지한다', async () => {
    renderControls();

    await pressShortcut('Space', true);

    expect(layerMocks.execute).toHaveBeenCalledWith({ type: AudioCommandType.STOP });
  });
});
