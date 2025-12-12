export interface AudioFile {
  file: File;
  name: string;
  size: number;
  formattedSize: string; // 포맷팅된 파일 크기 (예: "1.00 MB")
  type: string;
  duration?: number;
  formattedDuration?: string; // 포맷팅된 재생 시간 (예: "2:05")
  url: string;
  /**
   * 리소스 정리 함수 (예: Object URL 해제)
   * TrackContext는 이 함수를 통해 추상화된 방식으로 cleanup을 수행합니다.
   */
  dispose?: () => void;
}

export interface FileUploadProps {
  onFileUploaded?: (file: AudioFile) => void;
  autoReset?: boolean; // 업로드 후 자동으로 상태 초기화
}

