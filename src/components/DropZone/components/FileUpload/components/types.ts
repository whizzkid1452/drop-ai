export interface AudioFile {
  file: File;
  name: string;
  size: number;
  type: string;
  duration?: number;
  url: string;
}

export interface FileUploadProps {
  onFileUploaded?: (file: AudioFile) => void;
}

