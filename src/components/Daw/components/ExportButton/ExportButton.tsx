import { useState, useCallback } from 'react';
import { exportTracks, downloadBlob } from '../../utils/audioExport';
import type { AudioFile } from '@/components/DropZone/components/FileUpload/components/types';
import * as styles from './ExportButton.css';

interface ExportButtonProps {
  tracks: AudioFile[];
}


export function ExportButton({
  tracks,
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
      const blob = await exportTracks(tracks, (progressInfo) => {
        setProgress(progressInfo.progress);
      });

      // 파일 다운로드
      downloadBlob(blob, 'export.wav');

      setIsExporting(false);
      setProgress(0);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Export failed');
      setError(error.message);
      setIsExporting(false);
      setProgress(0);
      console.error('Export error:', error);
    }
  }, [tracks]);

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

