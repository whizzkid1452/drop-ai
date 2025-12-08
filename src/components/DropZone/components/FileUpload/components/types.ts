export interface AudioFile {
  file: File;
  name: string;
  size: number;
  formattedSize: string; // 포맷팅된 파일 크기 (예: "1.00 MB")
  type: string;
  duration?: number;
  url: string;
}

export interface FileUploadProps {
  onFileUploaded?: (file: AudioFile) => void;
}


