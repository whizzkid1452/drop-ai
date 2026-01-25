import { useState, useCallback } from 'react';
import * as styles from './ExportButton.css';
import type { ExportSettings } from './utils/audioExport';
import { useAudioCommand } from '@/logics/audio';
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

/**
 * ExportButton 컴포넌트
 *
 * AudioEngine을 통해 프로젝트의 모든 트랙을 내보냅니다.
 * - 명령 실행과 UI 행위(다운로드, 알림) 분리
 */
export function ExportButton({
  settings,
  onExportComplete,
  onExportError,
}: ExportButtonProps) {
  const { execute } = useAudioCommand();
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setError(null);

    try {
      await execute({
        type: AudioCommandType.EXPORT_AUDIO,
        filename: settings?.filename,
      });
      onExportComplete?.();
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Export failed');
      setError(errorObj);
      onExportError?.(errorObj);
    } finally {
      setIsExporting(false);
    }
  }, [execute, settings, onExportComplete, onExportError]);

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
      {error && (
        <div className={styles.errorMessage} role="alert">
          {error.message}
        </div>
      )}
    </div>
  );
}
