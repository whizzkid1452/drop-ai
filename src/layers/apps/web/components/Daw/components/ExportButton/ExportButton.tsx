import { useState } from 'react';
import * as styles from './ExportButton.css.ts';
import { useCommandExecutor } from '@/layers/apps/web/context/layer-hooks';
import { executeWebAudioCommand } from '@/layers/apps/web/utils/execute-web-audio-command';
import {
  KeyboardShortcutAction,
  KEYBOARD_SHORTCUT_LABELS,
  useKeyboardShortcutAction,
} from '@/layers/apps/web/keyboard-shortcuts/keyboard-shortcuts';
import { AudioCommandType } from '@/types/audioCommand.schema';
import { ErrorBoundary, useErrorBoundary, type FallbackProps } from 'react-error-boundary';

// interface ExportButtonProps removed

function ExportErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className={styles.container} style={{ borderColor: '#ff4444' }}>
      <span style={{ fontSize: '12px', color: '#ff4444', marginRight: '8px' }}>
        Export Failed: {(error as Error).message}
      </span>
      <button className={styles.exportButton} onClick={resetErrorBoundary} title="Retry">
        Retry
      </button>
    </div>
  );
}

function ExportButtonContent() {
  const [isExporting, setIsExporting] = useState(false);
  const commandExecutor = useCommandExecutor();
  const { showBoundary } = useErrorBoundary();

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const filename = `project-${Date.now()}`;
      await executeWebAudioCommand({
        commandExecutor,
        command: {
          type: AudioCommandType.EXPORT_AUDIO,
          filename,
        },
      });
    } catch (error) {
      console.error('Export failed:', error);
      showBoundary(error);
    } finally {
      setIsExporting(false);
    }
  };

  useKeyboardShortcutAction(
    KeyboardShortcutAction.EXPORT_AUDIO,
    () => {
      void handleExport();
    },
    !isExporting
  );

  return (
    <button
      className={styles.exportButton}
      onClick={handleExport}
      disabled={isExporting}
      title={`Export Audio (${KEYBOARD_SHORTCUT_LABELS[KeyboardShortcutAction.EXPORT_AUDIO]})`}
      aria-keyshortcuts="Control+Shift+E Meta+Shift+E"
    >
      {isExporting ? 'Exporting...' : 'Export'}
    </button>
  );
}

export function ExportButton() {
  return (
    <ErrorBoundary FallbackComponent={ExportErrorFallback}>
      <ExportButtonContent />
    </ErrorBoundary>
  );
}
