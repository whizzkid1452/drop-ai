import { useAudioEngineHandleWithUi } from '@/hooks/agent/useAudioEngineHandleWithUi';
import { AudioCommandType } from '@/types/audioCommand.schema';
import { useCallback, useState } from 'react';
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
 * - 일관된 명령 인터페이스 사용
 * - 통합된 에러 처리
 * - 의존성 주입으로 Store 추상화
 */
export function ExportButton({
  settings,
  onExportComplete,
  onExportError,
}: ExportButtonProps) {
  const { handleAudioCommand } = useAudioEngineHandleWithUi();
  
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Export 실행 함수
   * AudioEngine.execute()를 통해 일관된 방식으로 처리
   */
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setError(null);

    try {
      // AudioEngine.execute(EXPORT_AUDIO) 호출
      // - Store 접근은 AudioEngine 의존성이 처리
      // - 파일 다운로드는 useAudioEngineHandleWithUi가 처리
      await handleAudioCommand(
        { type: AudioCommandType.EXPORT_AUDIO },
        { exportFilename: settings?.filename || 'drop-ai-export' }
      );

      setIsExporting(false);
      onExportComplete?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Export failed');
      setError(error.message);
      setIsExporting(false);
      onExportError?.(error);
      // 에러는 이미 useAudioEngineHandleWithUi에서 alert 처리됨
    }
  }, [handleAudioCommand, settings, onExportComplete, onExportError]);

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
          {error}
        </div>
      )}
    </div>
  );
}
