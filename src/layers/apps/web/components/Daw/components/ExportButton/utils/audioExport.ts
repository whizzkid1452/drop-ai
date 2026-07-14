import type { ExportProgress, ExportSettings } from '../types';

/**
 * Blob???�일�??�운로드?�는 ?�퍼 ?�수
 *
 * @param blob - ?�운로드??Blob
 * @param filename - ?�일�?(?�장???�함)
 * @throws {Error} ?�운로드 ?�패 ??
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

    // URL ?�리 (?�간??지?????�리?�여 ?�운로드가 ?�료?�도�???
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to download blob: ${errorMessage}`);
  }
}

// ?�???�export (기존 import 경로 ?��?)
export type { ExportProgress, ExportSettings };
