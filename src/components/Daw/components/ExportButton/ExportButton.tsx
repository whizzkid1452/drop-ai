import { useAudioCommand, handleAudioEngineError } from '@/logics/audio';
import { AudioCommandType } from '@/types/audioCommand.schema';
import { useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
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
 * AudioEngine을 통해 프로젝트의 모든 트랙을 내보냅니다.
 * - 명령 실행과 UI 행위(다운로드, 알림) 분리
 */
export function ExportButton({
  settings,
  onExportComplete,
  onExportError,
}: ExportButtonProps) {
  const { execute } = useAudioCommand();
  const { exportStartTime, exportEndTime } = usePlaybackStore(
    useShallow(state => ({
      exportStartTime: state.exportStartTime,
      exportEndTime: state.exportEndTime,
    }))
  );
  
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Export 실행 함수
   */
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setError(null);

    try {
      const result = await execute({ type: AudioCommandType.EXPORT_AUDIO });

      if (result instanceof Blob) {
        let filename: string;
        
        // 1. 커스텀 파일명이 제공된 경우
        if (settings?.filename) {
          filename = settings.filename;
        }
        // 2. Export range가 있는 경우 자동 생성
        else if (exportStartTime !== null && exportEndTime !== null) {
          filename = `export_${exportStartTime}-${exportEndTime}s`;
        }
        // 3. 기본 파일명
        else {
          filename = 'export';
        }
        
        downloadBlob(result, `${filename}.wav`);
      }

      setIsExporting(false);
      onExportComplete?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Export failed');
      setError(error.message);
      setIsExporting(false);
      onExportError?.(error);
      
      // 공통 에러 핸들러 (alert 및 logging)
      handleAudioEngineError(err);
    }
  }, [execute, settings, exportStartTime, exportEndTime, onExportComplete, onExportError]);

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
