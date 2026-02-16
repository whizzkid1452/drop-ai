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
