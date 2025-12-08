/**
 * 재생 시간을 "분:초" 문자열로 포맷팅합니다.
 */
export const formatDuration = (seconds?: number) => {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

