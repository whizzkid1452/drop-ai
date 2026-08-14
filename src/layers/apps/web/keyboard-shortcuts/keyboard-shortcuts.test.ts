// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  KeyboardShortcutAction,
  resolveKeyboardShortcutAction,
  useGlobalKeyboardShortcuts,
  useKeyboardShortcutAction,
} from './keyboard-shortcuts';

interface KeyboardEventOptions {
  readonly altKey?: boolean;
  readonly code: string;
  readonly ctrlKey?: boolean;
  readonly isComposing?: boolean;
  readonly metaKey?: boolean;
  readonly repeat?: boolean;
  readonly shiftKey?: boolean;
  readonly target?: EventTarget | null;
}

const mountedRoots: Root[] = [];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createKeyboardEvent(options: KeyboardEventOptions) {
  return {
    altKey: options.altKey ?? false,
    code: options.code,
    ctrlKey: options.ctrlKey ?? false,
    isComposing: options.isComposing ?? false,
    metaKey: options.metaKey ?? false,
    repeat: options.repeat ?? false,
    shiftKey: options.shiftKey ?? false,
    target: options.target ?? null,
  };
}

function ShortcutHarness({
  action,
  onAction,
}: {
  readonly action: (typeof KeyboardShortcutAction)[keyof typeof KeyboardShortcutAction];
  readonly onAction: () => void;
}) {
  useGlobalKeyboardShortcuts();
  useKeyboardShortcutAction(action, onAction);
  return createElement('input', { 'aria-label': '텍스트 입력' });
}

function renderShortcutHarness(
  action: (typeof KeyboardShortcutAction)[keyof typeof KeyboardShortcutAction],
  onAction: () => void
) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);
  act(() => root.render(createElement(ShortcutHarness, { action, onAction })));
  return { host };
}

afterEach(() => {
  act(() => {
    mountedRoots.splice(0).forEach(root => root.unmount());
  });
  document.body.replaceChildren();
});

describe('resolveKeyboardShortcutAction', () => {
  it.each([
    [{ code: 'Space' }, KeyboardShortcutAction.TOGGLE_PLAYBACK],
    [{ code: 'Space', shiftKey: true }, KeyboardShortcutAction.STOP_PLAYBACK],
    [{ code: 'Home' }, KeyboardShortcutAction.SEEK_TO_START],
    [{ code: 'ArrowLeft' }, KeyboardShortcutAction.SEEK_BACKWARD],
    [{ code: 'ArrowRight' }, KeyboardShortcutAction.SEEK_FORWARD],
    [{ code: 'ArrowLeft', shiftKey: true }, KeyboardShortcutAction.SEEK_BACKWARD_LARGE],
    [{ code: 'ArrowRight', shiftKey: true }, KeyboardShortcutAction.SEEK_FORWARD_LARGE],
    [{ code: 'KeyZ', ctrlKey: true }, KeyboardShortcutAction.UNDO],
    [{ code: 'KeyZ', metaKey: true }, KeyboardShortcutAction.UNDO],
    [{ code: 'KeyZ', ctrlKey: true, shiftKey: true }, KeyboardShortcutAction.REDO],
    [{ code: 'KeyY', ctrlKey: true }, KeyboardShortcutAction.REDO],
    [{ code: 'KeyS', ctrlKey: true }, KeyboardShortcutAction.SAVE_PROJECT],
    [{ code: 'KeyS', metaKey: true }, KeyboardShortcutAction.SAVE_PROJECT],
    [{ code: 'KeyO', ctrlKey: true }, KeyboardShortcutAction.OPEN_PROJECT],
    [{ code: 'KeyO', ctrlKey: true, shiftKey: true }, KeyboardShortcutAction.REFRESH_PROJECT_LIST],
    [{ code: 'KeyE', ctrlKey: true, shiftKey: true }, KeyboardShortcutAction.EXPORT_AUDIO],
    [{ code: 'KeyC', ctrlKey: true }, KeyboardShortcutAction.COPY_REGIONS],
    [{ code: 'KeyX', metaKey: true }, KeyboardShortcutAction.CUT_REGIONS],
    [{ code: 'KeyV', ctrlKey: true }, KeyboardShortcutAction.PASTE_REGIONS],
    [{ code: 'KeyD', ctrlKey: true }, KeyboardShortcutAction.DUPLICATE_REGIONS],
    [{ altKey: true, code: 'ArrowLeft' }, KeyboardShortcutAction.NUDGE_REGIONS_BACKWARD],
    [{ altKey: true, code: 'ArrowRight' }, KeyboardShortcutAction.NUDGE_REGIONS_FORWARD],
    [{ code: 'Escape' }, KeyboardShortcutAction.CLEAR_EXPORT_RANGE],
    [{ code: 'Backquote' }, KeyboardShortcutAction.TOGGLE_TERMINAL],
    [{ code: 'KeyI' }, KeyboardShortcutAction.TOGGLE_INSPECTOR],
    [{ code: 'Equal' }, KeyboardShortcutAction.ZOOM_IN],
    [{ code: 'Equal', shiftKey: true }, KeyboardShortcutAction.ZOOM_IN],
    [{ code: 'NumpadAdd' }, KeyboardShortcutAction.ZOOM_IN],
    [{ code: 'Minus' }, KeyboardShortcutAction.ZOOM_OUT],
    [{ code: 'NumpadSubtract' }, KeyboardShortcutAction.ZOOM_OUT],
    [{ code: 'Digit0' }, KeyboardShortcutAction.RESET_ZOOM],
    [{ code: 'Numpad0' }, KeyboardShortcutAction.RESET_ZOOM],
  ] as const)('%o 입력을 %s 동작으로 해석한다', (eventOptions, expectedAction) => {
    expect(resolveKeyboardShortcutAction(createKeyboardEvent(eventOptions))).toBe(expectedAction);
  });

  it.each(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'])(
    '%s에 초점이 있으면 전역 단축키를 실행하지 않는다',
    tagName => {
      const target = document.createElement(tagName);

      expect(resolveKeyboardShortcutAction(createKeyboardEvent({ code: 'Space', target }))).toBeNull();
    }
  );

  it('contenteditable 요소 안에서는 전역 단축키를 실행하지 않는다', () => {
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    const target = document.createElement('span');
    editor.append(target);

    expect(resolveKeyboardShortcutAction(createKeyboardEvent({ code: 'Space', target }))).toBeNull();
  });

  it.each([
    { altKey: true, code: 'KeyS', ctrlKey: true },
    { code: 'KeyS' },
    { code: 'KeyZ', ctrlKey: true, metaKey: true },
    { code: 'Space', ctrlKey: true },
    { code: 'Unidentified' },
  ])('충돌하거나 정의되지 않은 입력 %o은 실행하지 않는다', eventOptions => {
    expect(resolveKeyboardShortcutAction(createKeyboardEvent(eventOptions))).toBeNull();
  });
});

describe('전역 단축키 연결', () => {
  it('키 입력을 등록된 동작으로 한 번 전달하고 브라우저 기본 동작을 막는다', () => {
    const onSave = vi.fn();
    renderShortcutHarness(KeyboardShortcutAction.SAVE_PROJECT, onSave);
    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      code: 'KeyS',
      ctrlKey: true,
    });

    act(() => window.dispatchEvent(event));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('일반 동작의 키 반복은 무시한다', () => {
    const onSave = vi.fn();
    renderShortcutHarness(KeyboardShortcutAction.SAVE_PROJECT, onSave);

    act(() =>
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          code: 'KeyS',
          ctrlKey: true,
          repeat: true,
        })
      )
    );

    expect(onSave).not.toHaveBeenCalled();
  });

  it('탐색 동작의 키 반복은 허용한다', () => {
    const onSeek = vi.fn();
    renderShortcutHarness(KeyboardShortcutAction.SEEK_FORWARD, onSeek);

    act(() =>
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          code: 'ArrowRight',
          repeat: true,
        })
      )
    );

    expect(onSeek).toHaveBeenCalledTimes(1);
  });

  it('입력 요소에서 발생한 키는 등록된 동작으로 전달하지 않는다', () => {
    const onTogglePlayback = vi.fn();
    const { host } = renderShortcutHarness(KeyboardShortcutAction.TOGGLE_PLAYBACK, onTogglePlayback);
    const input = host.querySelector('input');
    if (!input) {
      throw new Error('테스트 입력 요소를 찾지 못했습니다.');
    }

    act(() =>
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          code: 'Space',
        })
      )
    );

    expect(onTogglePlayback).not.toHaveBeenCalled();
  });
});
