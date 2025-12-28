import { exportProject } from '@/logics/audio/exportProject';
import { useTrackStore } from '@/stores/useTrackStore';
import { useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import * as styles from './ExportButton.css';
import { downloadBlob, type ExportSettings } from './utils/audioExport';

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
 * 프로젝트의 모든 트랙을 Tone.Offline을 사용하여 정확하게 내보냅니다.
 */
export function ExportButton({
  settings,
  onExportComplete,
  onExportError,
}: ExportButtonProps) {
  const tracks = useTrackStore(
    useShallow(state => Array.from(state.tracks.values()))
  );

  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Export 실행 함수
   */
  const handleExport = useCallback(async () => {
    if (tracks.length === 0) {
      setError('내보낼 트랙이 없습니다.');
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      // exportProject (Tone.Offline) 사용
      const blob = await exportProject(tracks);

      // 파일 다운로드
      const filename = settings?.filename || 'drop-ai-export';
      downloadBlob(blob, `${filename}.wav`);

      setIsExporting(false);
      onExportComplete?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Export failed');
      setError(error.message);
      setIsExporting(false);
      onExportError?.(error);
      console.error('Export error:', error);
    }
  }, [tracks, settings, onExportComplete, onExportError]);

  // 트랙이 없으면 버튼 비활성화
  const isDisabled = tracks.length === 0 || isExporting;

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
