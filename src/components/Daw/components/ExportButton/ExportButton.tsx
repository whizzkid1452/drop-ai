import { useState, useCallback } from 'react';
import { exportTracks, downloadBlob, type ExportSettings } from './utils/audioExport';
import type { AudioFile } from '@/components/DropZone/components/FileUpload/components/types';
import * as styles from './ExportButton.css';

/**
 * ExportButton 컴포넌트의 Props 타입 정의
 */
interface ExportButtonProps {
  /** 내보낼 오디오 트랙 배열 */
  tracks: AudioFile[];
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
 * 여러 오디오 트랙을 하나의 WAV 파일로 내보내는 버튼입니다.
 * Ardour의 export 기능을 참고하여 웹 환경에 맞게 구현했습니다.
 * 
 * @param tracks - 내보낼 오디오 트랙 배열
 * @param settings - Export 설정 옵션 (선택적)
 * @param onExportComplete - Export 완료 시 호출되는 콜백 함수 (선택적)
 * @param onExportError - Export 실패 시 호출되는 콜백 함수 (선택적)
 * 
 * @example
 * ```tsx
 * <ExportButton
 *   tracks={tracks}
 *   settings={{
 *     sampleRate: 44100,
 *     bitDepth: 16,
 *     normalize: true,
 *     filename: 'my-export'
 *   }}
 *   onExportComplete={() => console.log('Export complete!')}
 * />
 * ```
 */
export function ExportButton({
  tracks,
  settings,
  onExportComplete,
  onExportError,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /**
   * Export 실행 함수
   * 
   * 모든 트랙을 로드하고 믹싱한 후 WAV 파일로 내보냅니다.
   */
  const handleExport = useCallback(async () => {
    if (tracks.length === 0) {
      setError('내보낼 트랙이 없습니다.');
      return;
    }

    setIsExporting(true);
    setError(null);
    setProgress(0);

    try {
      const blob = await exportTracks(tracks, settings, (progressInfo) => {
        setProgress(progressInfo.progress);
      });

      // 파일 다운로드
      const filename = settings?.filename || 'export';
      downloadBlob(blob, `${filename}.wav`);

      setIsExporting(false);
      setProgress(0);
      onExportComplete?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Export failed');
      setError(error.message);
      setIsExporting(false);
      setProgress(0);
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
          <>
            <span className={styles.progressText}>
              내보내는 중... {Math.round(progress)}%
            </span>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        ) : (
          <span className={styles.buttonText}>내보내기</span>
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

