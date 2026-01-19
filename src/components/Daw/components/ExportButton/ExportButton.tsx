import { useProjectExport } from '@/logics/audio/useProjectExport';
import { useCallback } from 'react';
import * as styles from './ExportButton.css';
import type { ExportSettings } from './utils/audioExport';

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
  const { exportProject, isExporting, error } = useProjectExport();

  const handleExport = useCallback(() => {
    exportProject({
      filename: settings?.filename,
      onSuccess: onExportComplete,
      onError: onExportError,
    });
  }, [exportProject, settings, onExportComplete, onExportError]);

  // 버튼 비활성화: export 중일 때만
  const isDisabled = isExporting;

  return (
    <div className={styles.container}>
      <button
        className={styles.exportButton}
        onClick={handleExport}
        disabled={isDisabled}
        aria-label="오디오 내보내기"
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
