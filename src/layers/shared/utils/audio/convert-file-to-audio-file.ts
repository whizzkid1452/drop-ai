import type { AudioFile } from '../../types/audioFile';
import { getFileDuration } from './get-audio-metadata';
import { formatDuration } from '@/utils/audio/formatDuration';
import { formatFileSize } from '@/utils/audio/formatFileSize';

export type AudioFileMetadata = Omit<AudioFile, 'url' | 'dispose'>;

export async function convertFileToAudioFile(file: File): Promise<AudioFileMetadata | null> {
  try {
    let duration: number | undefined;

    try {
      duration = await getFileDuration(file);
    } catch (err) {
      console.warn('Unable to get file duration:', err);
    }

    return {
      file,
      name: file.name,
      size: file.size,
      formattedSize: formatFileSize(file.size),
      type: file.type,
      duration,
      formattedDuration: duration ? formatDuration(duration) : undefined,
      volume: 1,
    };
  } catch (err) {
    console.error(err);
    return null;
  }
}
