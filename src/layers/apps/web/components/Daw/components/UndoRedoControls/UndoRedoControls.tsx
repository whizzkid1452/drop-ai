import { useRef, useState } from 'react';
import { useCommandExecutor, useCommandHistory } from '@/layers/apps/web/context/layer-hooks';
import {
  KeyboardShortcutAction,
  KEYBOARD_SHORTCUT_LABELS,
  useKeyboardShortcutAction,
} from '@/layers/apps/web/keyboard-shortcuts/keyboard-shortcuts';
import { AudioCommandType } from '@/types/audioCommand.schema';
import * as styles from './UndoRedoControls.css';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function UndoRedoControls() {
  const commandExecutor = useCommandExecutor();
  const { canRedo, canUndo } = useCommandHistory();
  const isExecutingRef = useRef(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const executeHistoryCommand = async (commandType: typeof AudioCommandType.UNDO | typeof AudioCommandType.REDO) => {
    if (isExecutingRef.current) {
      return;
    }

    isExecutingRef.current = true;
    setIsExecuting(true);
    setErrorMessage(null);
    try {
      await commandExecutor.execute({ type: commandType });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      isExecutingRef.current = false;
      setIsExecuting(false);
    }
  };

  useKeyboardShortcutAction(
    KeyboardShortcutAction.UNDO,
    () => {
      void executeHistoryCommand(AudioCommandType.UNDO);
    },
    !isExecuting && canUndo
  );
  useKeyboardShortcutAction(
    KeyboardShortcutAction.REDO,
    () => {
      void executeHistoryCommand(AudioCommandType.REDO);
    },
    !isExecuting && canRedo
  );

  return (
    <div className={styles.container}>
      <button
        className={styles.button}
        type="button"
        disabled={isExecuting || !canUndo}
        onClick={() => void executeHistoryCommand(AudioCommandType.UNDO)}
        title={`실행 취소 (${KEYBOARD_SHORTCUT_LABELS[KeyboardShortcutAction.UNDO]})`}
        aria-keyshortcuts="Control+Z Meta+Z"
      >
        실행 취소
      </button>
      <button
        className={styles.button}
        type="button"
        disabled={isExecuting || !canRedo}
        onClick={() => void executeHistoryCommand(AudioCommandType.REDO)}
        title={`다시 실행 (${KEYBOARD_SHORTCUT_LABELS[KeyboardShortcutAction.REDO]})`}
        aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y Meta+Y"
      >
        다시 실행
      </button>
      {errorMessage ? (
        <span className={styles.error} role="alert">
          편집 기록 실행 실패: {errorMessage}
        </span>
      ) : null}
    </div>
  );
}
