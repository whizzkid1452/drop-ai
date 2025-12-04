import type { AudioFile } from '@/components/DropZone/components/FileUpload/components/types';
import * as styles from './Track.css';

/**
 * Track 컴포넌트의 Props 타입 정의
 * 
 * @property track - 표시할 오디오 파일 정보 (AudioFile 타입)
 * @property index - 트랙의 인덱스 (0부터 시작, 트랙 번호 표시에 사용)
 * @property onRemove - 트랙 제거 콜백 함수 (선택적, 제공 시 제거 버튼 표시)
 */
interface TrackProps {
  track: AudioFile;
  index: number;
  onRemove?: (index: number) => void;
}

/**
 * Track 컴포넌트
 * 
 * 개별 오디오 트랙을 표시하는 컴포넌트입니다.
 * - 트랙 번호, 파일명, 재생 시간, 파일 크기 표시
 * - HTML5 audio 플레이어를 통한 오디오 재생 기능
 * - 트랙 제거 기능 (선택적)
 * 
 * @param track - 표시할 오디오 파일 정보
 * @param index - 트랙의 인덱스 (트랙 번호 계산에 사용)
 * @param onRemove - 트랙 제거 콜백 함수 (선택적)
 * 
 * @example
 * ```tsx
 * <Track 
 *   track={audioFile} 
 *   index={0} 
 *   onRemove={handleRemove} 
 * />
 * ```
 */
export function Track({ track, index, onRemove }: TrackProps) {
  /**
   * 재생 시간을 포맷팅하는 함수
   * 
   * 초 단위 숫자를 "분:초" 형식의 문자열로 변환합니다.
   * - duration이 없거나 undefined인 경우 "--:--" 반환
   * - 초는 항상 2자리로 표시 (예: "3:05", "12:30")
   * 
   * @param seconds - 재생 시간 (초 단위, 선택적)
   * @returns 포맷팅된 시간 문자열 (예: "3:45", "--:--")
   * 
   * @example
   * formatDuration(125) // "2:05"
   * formatDuration(undefined) // "--:--"
   */
  const formatDuration = (seconds?: number) => {
    // 재생 시간이 없는 경우 기본값 반환
    if (!seconds) return '--:--';
    
    // 분과 초 계산
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    
    // 초를 2자리 문자열로 변환 (padStart로 앞에 0 추가)
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * 파일 크기를 포맷팅하는 함수
   * 
   * 바이트 단위 숫자를 읽기 쉬운 형식으로 변환합니다.
   * - 1024 바이트 미만: "B" 단위
   * - 1024 바이트 이상 ~ 1MB 미만: "KB" 단위 (소수점 1자리)
   * - 1MB 이상: "MB" 단위 (소수점 1자리)
   * 
   * @param bytes - 파일 크기 (바이트 단위)
   * @returns 포맷팅된 파일 크기 문자열 (예: "1.5 MB", "256.0 KB")
   * 
   * @example
   * formatFileSize(1024) // "1.0 KB"
   * formatFileSize(1048576) // "1.0 MB"
   * formatFileSize(512) // "512 B"
   */
  const formatFileSize = (bytes: number) => {
    // 1KB 미만: 바이트 단위로 표시
    if (bytes < 1024) return `${bytes} B`;
    
    // 1MB 미만: 킬로바이트 단위로 표시 (소수점 1자리)
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    
    // 1MB 이상: 메가바이트 단위로 표시 (소수점 1자리)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={styles.track}>
      {/* 트랙 헤더: 트랙 정보와 제거 버튼 */}
      <div className={styles.trackHeader}>
        {/* 트랙 정보 영역: 번호, 파일명, 메타데이터 */}
        <div className={styles.trackInfo}>
          {/* 트랙 번호 표시 (인덱스 + 1, 1부터 시작) */}
          <span className={styles.trackNumber}>{index + 1}</span>
          
          {/* 트랙 상세 정보: 파일명과 메타데이터 */}
          <div className={styles.trackDetails}>
            {/* 파일명 표시 */}
            <span className={styles.trackName}>{track.name}</span>
            
            {/* 메타데이터: 재생 시간과 파일 크기 */}
            <span className={styles.trackMeta}>
              {formatDuration(track.duration)} • {formatFileSize(track.size)}
            </span>
          </div>
        </div>
        
        {/* 트랙 제거 버튼 (onRemove가 제공된 경우에만 표시) */}
        {onRemove && (
          <button
            className={styles.removeButton}
            onClick={() => onRemove(index)}
            aria-label="트랙 제거"
          >
            ×
          </button>
        )}
      </div>
      
      {/* 트랙 콘텐츠 영역: 오디오 플레이어 */}
      <div className={styles.trackContent}>
        {/* HTML5 audio 요소: 브라우저 기본 컨트롤 제공 */}
        <audio controls src={track.url} className={styles.audioPlayer} />
      </div>
    </div>
  );
}

