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
   * 볼륨 레벨 (0.0 ~ 1.0, 기본값: 1.0)
   * 재생 시 WaveSurfer의 setVolume()에 사용되고, Export 시 믹싱에 적용됩니다.
   */
  volume?: number;
  /**
   * 리소스 정리 함수 (예: Object URL 해제)
   * TrackContext는 이 함수를 통해 추상화된 방식으로 cleanup을 수행합니다.
   */
  dispose?: () => void;
}

export interface FileUploadProps {
  onFileUploaded?: (file: AudioFile) => void;
  /**
   * 미리보기 상태에서 "Edit here" 버튼을 눌렀을 때 호출됩니다.
   * 업로드된 파일을 트랙 목록 등 상위 컨텍스트로 전달할 때 사용합니다.
   */
  onEdit?: (file: AudioFile) => void;
  autoReset?: boolean; // 업로드 후 자동으로 상태 초기화
}


