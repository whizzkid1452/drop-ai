const LOADING_TEXT_MAP: Record<string, string> = {
  '분석 중': 'ANALYZING',
  분석중: 'ANALYZING',
  '로딩 중': 'LOADING',
  로딩중: 'LOADING',
};

export function formatLoadingDisplayText(modelLoadingText: string): string {
  const trimmed = modelLoadingText.trim();
  for (const [ko, en] of Object.entries(LOADING_TEXT_MAP)) {
    if (trimmed === ko || trimmed.includes(ko)) return `${en}...`;
  }
  const upper = modelLoadingText.toUpperCase();
  return upper.endsWith('...') ? upper : `${upper}...`;
}
