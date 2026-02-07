import type { ExportProgress, ExportSettings } from '../types';

/**
 * Blob을 파일로 다운로드하는 헬퍼 함수
 *
 * @param blob - 다운로드할 Blob
 * @param filename - 파일명 (확장자 포함)
 * @throws {Error} 다운로드 실패 시
 */
export function downloadBlob(blob: Blob, filename: string): void {
  try {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';

    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    // URL 정리 (약간의 지연 후 정리하여 다운로드가 완료되도록 함)
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to download blob: ${errorMessage}`);
  }
}

// 타입 재export (기존 import 경로 유지)
export type { ExportProgress, ExportSettings };
