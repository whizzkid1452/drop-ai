import type { AudioFile } from '../../components/Daw/components/FileUpload/components/types';
import { getFileDuration } from '../../components/Daw/components/FileUpload/utils/audioMetadata';
import { formatDuration } from '@/components/Daw/utils/formatDuration';
import { formatFileSize } from '@/components/Daw/utils/formatFileSize';

export async function convertFileToAudioFile(file: File) {
  try {
    const url = URL.createObjectURL(file);
    let duration: number | undefined;

    try {
      duration = await getFileDuration(file);
    } catch (err) {
      console.warn('Unable to get file duration:', err);
    }

    const audioFile: AudioFile = {
      file,
      name: file.name,
      size: file.size,
      formattedSize: formatFileSize(file.size),
      type: file.type,
      duration,
      formattedDuration: duration ? formatDuration(duration) : undefined,
      url,
      volume: 1.0, // 기본 볼륨 레벨
    };

    return audioFile;
  } catch (err) {
    console.error(err);
    return null;
  }
}
