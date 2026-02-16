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
