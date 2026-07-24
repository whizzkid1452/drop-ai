import { useEffect, useRef } from 'react';

const KEYBOARD_SHORTCUT_EVENT_NAME = 'drop-ai:keyboard-shortcut';

export const KeyboardShortcutAction = {
  CLEAR_EXPORT_RANGE: 'CLEAR_EXPORT_RANGE',
  EXPORT_AUDIO: 'EXPORT_AUDIO',
  OPEN_PROJECT: 'OPEN_PROJECT',
  REDO: 'REDO',
  REFRESH_PROJECT_LIST: 'REFRESH_PROJECT_LIST',
  RESET_ZOOM: 'RESET_ZOOM',
  SAVE_PROJECT: 'SAVE_PROJECT',
  SEEK_BACKWARD: 'SEEK_BACKWARD',
  SEEK_BACKWARD_LARGE: 'SEEK_BACKWARD_LARGE',
  SEEK_FORWARD: 'SEEK_FORWARD',
  SEEK_FORWARD_LARGE: 'SEEK_FORWARD_LARGE',
  SEEK_TO_START: 'SEEK_TO_START',
  STOP_PLAYBACK: 'STOP_PLAYBACK',
  TOGGLE_INSPECTOR: 'TOGGLE_INSPECTOR',
  TOGGLE_PLAYBACK: 'TOGGLE_PLAYBACK',
  TOGGLE_TERMINAL: 'TOGGLE_TERMINAL',
  UNDO: 'UNDO',
  ZOOM_IN: 'ZOOM_IN',
  ZOOM_OUT: 'ZOOM_OUT',
} as const;

export type KeyboardShortcutAction = (typeof KeyboardShortcutAction)[keyof typeof KeyboardShortcutAction];

export const KEYBOARD_SHORTCUT_LABELS: Readonly<Record<KeyboardShortcutAction, string>> = {
  [KeyboardShortcutAction.CLEAR_EXPORT_RANGE]: 'Esc',
  [KeyboardShortcutAction.EXPORT_AUDIO]: 'Ctrl/⌘+Shift+E',
  [KeyboardShortcutAction.OPEN_PROJECT]: 'Ctrl/⌘+O',
  [KeyboardShortcutAction.REDO]: 'Ctrl/⌘+Shift+Z · Ctrl/⌘+Y',
  [KeyboardShortcutAction.REFRESH_PROJECT_LIST]: 'Ctrl/⌘+Shift+O',
  [KeyboardShortcutAction.RESET_ZOOM]: '0',
  [KeyboardShortcutAction.SAVE_PROJECT]: 'Ctrl/⌘+S',
  [KeyboardShortcutAction.SEEK_BACKWARD]: '←',
  [KeyboardShortcutAction.SEEK_BACKWARD_LARGE]: 'Shift+←',
  [KeyboardShortcutAction.SEEK_FORWARD]: '→',
  [KeyboardShortcutAction.SEEK_FORWARD_LARGE]: 'Shift+→',
  [KeyboardShortcutAction.SEEK_TO_START]: 'Home',
  [KeyboardShortcutAction.STOP_PLAYBACK]: 'Shift+Space',
  [KeyboardShortcutAction.TOGGLE_INSPECTOR]: 'I',
  [KeyboardShortcutAction.TOGGLE_PLAYBACK]: 'Space',
  [KeyboardShortcutAction.TOGGLE_TERMINAL]: '`',
  [KeyboardShortcutAction.UNDO]: 'Ctrl/⌘+Z',
  [KeyboardShortcutAction.ZOOM_IN]: '+',
  [KeyboardShortcutAction.ZOOM_OUT]: '-',
};

interface KeyboardShortcutEvent {
  readonly altKey: boolean;
  readonly code: string;
  readonly ctrlKey: boolean;
  readonly isComposing: boolean;
  readonly metaKey: boolean;
  readonly repeat: boolean;
  readonly shiftKey: boolean;
  readonly target: EventTarget | null;
}

const REPEATABLE_ACTIONS = new Set<KeyboardShortcutAction>([
  KeyboardShortcutAction.SEEK_BACKWARD,
  KeyboardShortcutAction.SEEK_BACKWARD_LARGE,
  KeyboardShortcutAction.SEEK_FORWARD,
  KeyboardShortcutAction.SEEK_FORWARD_LARGE,
  KeyboardShortcutAction.ZOOM_IN,
  KeyboardShortcutAction.ZOOM_OUT,
]);

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Node)) {
    return false;
  }

  const element = target instanceof Element ? target : target.parentElement;
  return Boolean(
    element?.closest(
      'a, button, input, select, textarea, [contenteditable]:not([contenteditable="false"]), ' +
        '[role="button"], [role="combobox"], [role="link"], [role="slider"], [role="textbox"]'
    )
  );
}

function resolvePrimaryModifierAction(event: KeyboardShortcutEvent): KeyboardShortcutAction | null {
  if (event.code === 'KeyZ') {
    return event.shiftKey ? KeyboardShortcutAction.REDO : KeyboardShortcutAction.UNDO;
  }
  if (event.code === 'KeyY' && !event.shiftKey) {
    return KeyboardShortcutAction.REDO;
  }
  if (event.code === 'KeyS' && !event.shiftKey) {
    return KeyboardShortcutAction.SAVE_PROJECT;
  }
  if (event.code === 'KeyO') {
    return event.shiftKey ? KeyboardShortcutAction.REFRESH_PROJECT_LIST : KeyboardShortcutAction.OPEN_PROJECT;
  }
  if (event.code === 'KeyE' && event.shiftKey) {
    return KeyboardShortcutAction.EXPORT_AUDIO;
  }
  return null;
}

function resolvePlainAction(event: KeyboardShortcutEvent): KeyboardShortcutAction | null {
  if (event.code === 'Space') {
    return event.shiftKey ? KeyboardShortcutAction.STOP_PLAYBACK : KeyboardShortcutAction.TOGGLE_PLAYBACK;
  }
  if (event.code === 'ArrowLeft') {
    return event.shiftKey ? KeyboardShortcutAction.SEEK_BACKWARD_LARGE : KeyboardShortcutAction.SEEK_BACKWARD;
  }
  if (event.code === 'ArrowRight') {
    return event.shiftKey ? KeyboardShortcutAction.SEEK_FORWARD_LARGE : KeyboardShortcutAction.SEEK_FORWARD;
  }
  if (event.code === 'Equal' || event.code === 'NumpadAdd') {
    return KeyboardShortcutAction.ZOOM_IN;
  }
  if (event.shiftKey) {
    return null;
  }

  const actionByCode: Readonly<Record<string, KeyboardShortcutAction | undefined>> = {
    Backquote: KeyboardShortcutAction.TOGGLE_TERMINAL,
    Digit0: KeyboardShortcutAction.RESET_ZOOM,
    Escape: KeyboardShortcutAction.CLEAR_EXPORT_RANGE,
    Home: KeyboardShortcutAction.SEEK_TO_START,
    KeyI: KeyboardShortcutAction.TOGGLE_INSPECTOR,
    Minus: KeyboardShortcutAction.ZOOM_OUT,
    Numpad0: KeyboardShortcutAction.RESET_ZOOM,
    NumpadSubtract: KeyboardShortcutAction.ZOOM_OUT,
  };
  return actionByCode[event.code] ?? null;
}

export function resolveKeyboardShortcutAction(event: KeyboardShortcutEvent): KeyboardShortcutAction | null {
  if (event.isComposing || event.altKey || isInteractiveTarget(event.target)) {
    return null;
  }

  const hasPrimaryModifier = event.ctrlKey || event.metaKey;
  if (event.ctrlKey && event.metaKey) {
    return null;
  }
  if (hasPrimaryModifier) {
    return resolvePrimaryModifierAction(event);
  }
  return resolvePlainAction(event);
}

// 각 컴포넌트의 기존 검증·후처리 경로를 재사용하기 위해 동작 식별자만 전달한다.
function dispatchKeyboardShortcutAction(action: KeyboardShortcutAction): void {
  window.dispatchEvent(new CustomEvent<KeyboardShortcutAction>(KEYBOARD_SHORTCUT_EVENT_NAME, { detail: action }));
}

export function useGlobalKeyboardShortcuts(): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const action = resolveKeyboardShortcutAction(event);
      if (!action) {
        return;
      }

      event.preventDefault();
      if (event.repeat && !REPEATABLE_ACTIONS.has(action)) {
        return;
      }
      dispatchKeyboardShortcutAction(action);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}

export function useKeyboardShortcutAction(action: KeyboardShortcutAction, handler: () => void, isEnabled = true): void {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const handleShortcut = (event: Event): void => {
      const shortcutEvent = event as CustomEvent<KeyboardShortcutAction>;
      if (shortcutEvent.detail === action) {
        handlerRef.current();
      }
    };

    window.addEventListener(KEYBOARD_SHORTCUT_EVENT_NAME, handleShortcut);
    return () => window.removeEventListener(KEYBOARD_SHORTCUT_EVENT_NAME, handleShortcut);
  }, [action, isEnabled]);
}
