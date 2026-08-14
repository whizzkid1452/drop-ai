import type { ProjectBwfMetadata } from './project-document.schema';
import type { AudioCodec } from '../utils/audio/audio-source-file-metadata';

export interface AudioFile {
  file: File;
  name: string;
  size: number;
  formattedSize: string; // 포맷팅된 파일 크기 (예: "1.00 MB")
  type: string;
  duration?: number;
  formattedDuration?: string; // 포맷팅된 재생 시간 (예: "2:05")
  volume?: number;
  bwfMetadata?: ProjectBwfMetadata | null;
  detectedCodec?: AudioCodec;
}
