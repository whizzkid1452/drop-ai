import * as styles from './FileLibrary.css';
import type { FileLibraryProps } from '@/types/daw';

/**
 * 파일 라이브러리 컴포넌트
 * - 업로드된 파일 목록 표시
 * - 파일 삭제
 */
export function FileLibrary({ files, onDeleteFile }: FileLibraryProps) {
  if (files.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>업로드된 파일이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>파일 라이브러리</h3>
      <div className={styles.fileList}>
        {files.map(file => (
          <div key={file.id} className={styles.fileItem}>
            <div className={styles.fileInfo}>
              <span className={styles.fileName}>{file.file.name}</span>
              <span className={styles.fileSize}>
                {(file.file.size / 1024 / 1024).toFixed(2)} MB
              </span>
              <span className={styles.fileDuration}>
                {file.buffer.duration.toFixed(2)}초
              </span>
            </div>
            <div className={styles.fileActions}>
              {file.track && (
                <span className={styles.trackInfo}>
                  트랙: {file.track.getName()}
                </span>
              )}
              <button
                className={styles.deleteButton}
                onClick={() => onDeleteFile(file.id)}
              >
                삭제
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
