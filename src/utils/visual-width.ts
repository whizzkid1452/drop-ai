/**
 * Calculate the visual width of a string.
 * Korean/CJK characters are counted as 2 spaces.
 * Also handles NFC/NFD normalization.
 */
export const getVisualWidth = (str: string): number => {
  const normalized = str.normalize('NFC');
  let width = 0;
  for (const char of normalized) {
    // Check for CJK characters range
    // This is a simplified check for common CJK ranges
    if (
      (char >= '\u1100' && char <= '\u11FF') || // Hangul Jamo
      (char >= '\u3130' && char <= '\u318F') || // Hangul Compatibility Jamo
      (char >= '\uA960' && char <= '\uA97F') || // Hangul Jamo Extended-A
      (char >= '\uAC00' && char <= '\uD7AF') || // Hangul Syllables
      (char >= '\uD7B0' && char <= '\uD7FF') || // Hangul Jamo Extended-B
      (char >= '\u4E00' && char <= '\u9FFF') || // CJK Unified Ideographs
      (char >= '\uF900' && char <= '\uFAFF') || // CJK Compatibility Ideographs
      (char >= '\u3040' && char <= '\u309F') || // Hiragana
      (char >= '\u30A0' && char <= '\u30FF') // Katakana
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
};

/**
 * Pad a string to the right with spaces based on its visual width.
 */
export const padRight = (str: string, length: number): string => {
  const normalized = str.normalize('NFC');
  const visualWidth = getVisualWidth(normalized);
  const padding = Math.max(0, length - visualWidth);
  return normalized + ' '.repeat(padding);
};
