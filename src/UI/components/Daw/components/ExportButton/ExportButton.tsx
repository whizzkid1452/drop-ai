import { useState, useCallback } from 'react';
import { ErrorBoundary, useErrorBoundary, type FallbackProps } from 'react-error-boundary';
import * as styles from './ExportButton.css';
import type { ExportSettings } from './utils/audioExport';
import { useAudioCommand } from '@/AudioEngine/logics';
import { AudioCommandType } from '@/types/audioCommand.schema';

/**
 * ExportButton 컴포넌트의 Props 타입 정의
 */
interface ExportButtonProps {
  /** Export 설정 옵션 (선택적) */
  settings?: ExportSettings;
  /** Export 완료 시 호출되는 콜백 함수 (선택적) */
  onExportComplete?: () => void;
  /** Export 실패 시 호출되는 콜백 함수 (선택적) */
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
 * ExportButton 로직 및 UI (내부 컴포넌트)
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

  // 버튼 비활성화: export 중일 때만
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
 * ExportButton 컴포넌트
 * 
 * ErrorBoundary로 감싸져 있어 에러 발생 시 Fallback UI를 보여줍니다.
 */
export function ExportButton(props: ExportButtonProps) {
  return (
    <ErrorBoundary FallbackComponent={ExportErrorFallback}>
      <ExportButtonContent {...props} />
    </ErrorBoundary>
  );
}
