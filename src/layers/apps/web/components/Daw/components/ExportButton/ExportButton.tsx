import { useState, useCallback } from 'react';
import { ErrorBoundary, useErrorBoundary, type FallbackProps } from 'react-error-boundary';
import * as styles from './ExportButton.css.ts';
import type { ExportSettings } from './utils/audioExport';
import { useAudioCommand } from '@/logics/audio';
import { AudioCommandType } from '@/types/audioCommand.schema';

/**
 * ExportButton Ïª¥Ìè¨?åÌä∏??Props ?Ä???ïÏùò
 */
interface ExportButtonProps {
  /** Export ?§Ï†ï ?µÏÖò (?†ÌÉù?? */
  settings?: ExportSettings;
  /** Export ?ÑÎ£å ???∏Ï∂ú?òÎäî ÏΩúÎ∞± ?®Ïàò (?†ÌÉù?? */
  onExportComplete?: () => void;
  /** Export ?§Ìå® ???∏Ï∂ú?òÎäî ÏΩúÎ∞± ?®Ïàò (?†ÌÉù?? */
  onExportError?: (error: Error) => void;
}

function ExportErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const errorMessage = error instanceof Error ? error.message : 'Export failed';
  return (
    <div className={styles.container}>
      <div className={styles.errorMessage} role="alert">
        {errorMessage}
      </div>
      <button 
        className={styles.exportButton} 
        onClick={resetErrorBoundary}
        style={{ marginTop: '4px' }}
      >
        <span className={styles.buttonText}>Retry</span>
      </button>
    </div>
  );
}

/**
 * ExportButton Î°úÏßÅ Î∞?UI (?¥Î? Ïª¥Ìè¨?åÌä∏)
 */
function ExportButtonContent({
  settings,
  onExportComplete,
  onExportError,
}: ExportButtonProps) {
  const { execute } = useAudioCommand();
  const { showBoundary } = useErrorBoundary();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setIsExporting(true);

    try {
      await execute({
        type: AudioCommandType.EXPORT_AUDIO,
        filename: settings?.filename,
      });
      onExportComplete?.();
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Export failed');
      onExportError?.(errorObj);
      showBoundary(errorObj);
    } finally {
      setIsExporting(false);
    }
  }, [execute, settings, onExportComplete, onExportError, showBoundary]);

  // Î≤ÑÌäº ÎπÑÌôú?±Ìôî: export Ï§ëÏùº ?åÎßå
  const isDisabled = isExporting;

  return (
    <div className={styles.container}>
      <button
        className={styles.exportButton}
        onClick={handleExport}
        disabled={isDisabled}
        aria-label="Export audio"
      >
        {isExporting ? (
          <span className={styles.progressText}>Exporting...</span>
        ) : (
          <span className={styles.buttonText}>Export</span>
        )}
      </button>
    </div>
  );
}

/**
 * ExportButton Ïª¥Ìè¨?åÌä∏
 * 
 * ErrorBoundaryÎ°?Í∞êÏã∏???àÏñ¥ ?êÎü¨ Î∞úÏÉù ??Fallback UIÎ•?Î≥¥Ïó¨Ï§çÎãà??
 */
export function ExportButton(props: ExportButtonProps) {
  return (
    <ErrorBoundary FallbackComponent={ExportErrorFallback}>
      <ExportButtonContent {...props} />
    </ErrorBoundary>
  );
}
