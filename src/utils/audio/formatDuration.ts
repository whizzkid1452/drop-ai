/**
 * 재생 시간을 "분:초" 문자열로 포맷팅합니다.
 * 예: 125 -> "2:05", undefined -> "--:--"
 * 
 * @param seconds - 초 단위의 재생 시간 (선택적)
 * @returns 포맷팅된 재생 시간 문자열
 */
export function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

