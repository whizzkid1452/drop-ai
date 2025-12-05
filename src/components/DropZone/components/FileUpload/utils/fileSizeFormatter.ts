/**
 * 파일 크기를 MB 단위로 변환하고 포맷팅하는 유틸리티 함수
 * 
 * @param sizeInBytes - 바이트 단위의 파일 크기
 * @returns 포맷팅된 파일 크기 문자열 (예: "539MB")
 * 
 * @example
 * ```typescript
 * formatFileSize(539 * 1024 * 1024); // "539MB"
 * formatFileSize(1.5 * 1024 * 1024); // "1.5MB"
 * ```
 */
export function formatFileSize(sizeInBytes: number): string {
  const sizeInMB = sizeInBytes / (1024 * 1024);
  // 소수점 첫째 자리까지 표시하되, 정수인 경우는 정수로 표시
  const rounded = Math.round(sizeInMB * 10) / 10;
  return `${rounded}MB`;
}

