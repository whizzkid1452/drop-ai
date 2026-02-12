import type { ExportProgress, ExportSettings } from '../types';

/**
 * Blob???Œì¼ë¡??¤ìš´ë¡œë“œ?˜ëŠ” ?¬í¼ ?¨ìˆ˜
 *
 * @param blob - ?¤ìš´ë¡œë“œ??Blob
 * @param filename - ?Œì¼ëª?(?•ìž¥???¬í•¨)
 * @throws {Error} ?¤ìš´ë¡œë“œ ?¤íŒ¨ ??
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

    // URL ?•ë¦¬ (?½ê°„??ì§€?????•ë¦¬?˜ì—¬ ?¤ìš´ë¡œë“œê°€ ?„ë£Œ?˜ë„ë¡???
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to download blob: ${errorMessage}`);
  }
}

// ?€???¬export (ê¸°ì¡´ import ê²½ë¡œ ? ì?)
export type { ExportProgress, ExportSettings };
