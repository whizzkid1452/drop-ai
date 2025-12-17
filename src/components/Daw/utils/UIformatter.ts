/**
 * 바이트 단위 파일 크기를 사람이 읽기 쉬운 문자열로 변환합니다.
 * 예: 1048576 -> "1.00 MB"
 * 
 * @param bytes - 바이트 단위의 파일 크기
 * @returns 포맷팅된 파일 크기 문자열
 */
export function formatFileSize(bytes: number): string {
  if (Number.isNaN(bytes) || bytes < 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

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
