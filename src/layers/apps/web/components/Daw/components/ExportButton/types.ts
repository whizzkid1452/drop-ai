/**
 * Export ?¤ì • ?µì…˜
 * Ardour??ExportSettingsë¥?ì°¸ê³ ?˜ì—¬ ???˜ê²½??ë§ê²Œ êµ¬í˜„
 */
export interface ExportSettings {
  /** ?˜í”Œ?ˆì´??(Hz), ê¸°ë³¸ê°? 44100 */
  sampleRate?: number;
  /** ë¹„íŠ¸ ê¹Šì´ (16, 24, 32, ?ëŠ” 'float'), ê¸°ë³¸ê°? 16 */
  bitDepth?: 16 | 24 | 32 | 'float';
  /** ?•ê·œ???¬ë?, ê¸°ë³¸ê°? false */
  normalize?: boolean;
  /** ì¶œë ¥ ?Œì¼ëª?(?•ì¥???œì™¸), ê¸°ë³¸ê°? 'export' */
  filename?: string;
}

/**
 * Export ì§„í–‰ ?íƒœ ?•ë³´
 */
export interface ExportProgress {
  /** ì§„í–‰ë¥?(0-100) */
  progress: number;
  /** ?„ì¬ ?¨ê³„ ?¤ëª… */
  stage: 'loading' | 'mixing' | 'encoding' | 'complete';
}

/**
 * WAV ?¤ë” ?•ë³´
 */
export interface WavHeaderInfo {
  dataChunkOffset: number;
  totalSize: number;
  dataSize: number;
  bytesPerSample: number;
}


